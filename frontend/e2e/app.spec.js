import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'admin@test.local';
const TEST_PASSWORD = 'correct-password';
const TEST_PART = {
    id: 1,
    codigo_producto: 'TEST-001',
    name: 'TEST-001',
    codigo: 'A-001',
    familia: 'Retenes',
    marca: 'Marca QA',
    mundial: 'Mundial QA',
    internal_measure: 20,
    external_measure: 30,
    height: 5,
    flange_measure: 0,
    tope: 0,
    cost_price: 10,
    pv_geli: 15,
    stock: 5,
    aplicacion: 'Prueba automatizada',
};

function json(route, body, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
    });
}

async function mockSupabase(page, { role = 'admin' } = {}) {
    const user = {
        id: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: TEST_EMAIL,
        app_metadata: { role },
        user_metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
    };
    const session = {
        access_token: 'playwright-access-token',
        refresh_token: 'playwright-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
    };

    await page.route(/127\.0\.0\.1:54321\/auth\/v1\/.*/, async route => {
        const request = route.request();
        const url = request.url();

        if (url.includes('/token')) {
            const body = JSON.parse(request.postData() || '{}');
            if (body.email !== TEST_EMAIL || body.password !== TEST_PASSWORD) {
                return json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
            }
            return json(route, session);
        }
        if (url.includes('/user')) return json(route, user);
        if (url.includes('/settings')) return json(route, { disable_signup: true });
        if (url.includes('/logout')) return route.fulfill({ status: 204, body: '' });
        return json(route, {});
    });

    await page.route(/127\.0\.0\.1:54321\/rest\/v1\/.*/, async route => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.pathname.split('/').pop();

        if (resource === 'parts' && request.method() === 'GET') return json(route, [TEST_PART]);
        if (resource === 'supply_orders' && request.method() === 'GET') return json(route, []);
        if (resource === 'sales' && request.method() === 'GET') return json(route, []);
        if (resource === 'wholesale_orders' && request.method() === 'GET') return json(route, []);
        if (resource === 'quotations' && request.method() === 'GET') return json(route, []);
        if (resource === 'stock_movements' && request.method() === 'GET') return json(route, []);

        // Mutations are not executed by these smoke tests; return valid Supabase-shaped data.
        if (request.method() === 'GET') return json(route, []);
        return json(route, {});
    });

    await page.route(/127\.0\.0\.1:54321\/functions\/v1\/.*/, route => json(route, {}));
}

async function login(page, role = 'admin') {
    await mockSupabase(page, { role });
    await page.goto('/');
    await page.getByPlaceholder('admin@retenes.app').fill(TEST_EMAIL);
    await page.getByPlaceholder('Contraseña').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('button', { name: 'Productos' })).toBeVisible();
}

test('rechaza credenciales inválidas sin abandonar la pantalla de acceso', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.getByPlaceholder('admin@retenes.app').fill(TEST_EMAIL);
    await page.getByPlaceholder('Contraseña').fill('wrong-password');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByText('Credenciales incorrectas')).toBeVisible();
    await expect(page.getByText('Inicia sesión para continuar')).toBeVisible();
});

test('admin puede navegar por los módulos principales y ve mantenimiento', async ({ page }) => {
    await login(page, 'admin');
    await expect(page.getByRole('button', { name: 'Mantenimiento' })).toBeVisible();

    const modules = [
        ['Pedidos', 'Lista de Pedidos'],
        ['Ventas', 'Ventas del dia'],
        ['Hist. Mayor', 'Historial de Ventas por Mayor'],
        ['Cotizaciones', 'Cotizaciones'],
        ['Mantenimiento', 'Mantenimiento de la Base de Datos'],
    ];

    for (const [navigation, heading] of modules) {
        await page.getByRole('button', { name: navigation, exact: true }).click();
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
});

test('un usuario no administrador no ve el módulo de mantenimiento', async ({ page }) => {
    await login(page, 'user');
    await expect(page.getByRole('button', { name: 'Mantenimiento', exact: true })).toHaveCount(0);
});

test('reducir stock exige confirmación antes de enviar la operación', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    const row = page.getByRole('row').filter({ hasText: 'TEST-001' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '− Stock' }).click();
    await expect(page.getByRole('heading', { name: /Reducir Stock: TEST-001/ })).toBeVisible();

    const stockForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Continuar retiro' }) });
    await stockForm.getByRole('spinbutton').fill('2');
    await stockForm.getByRole('button', { name: 'Continuar retiro' }).click();
    await expect(page.getByText(/Confirmar el retiro de 2 unidad/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
    await expect(page.getByText(/Confirmar el retiro de 2 unidad/)).toHaveCount(0);
});
