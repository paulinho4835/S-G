import { supabase } from './supabase';

const TOLERANCE = 0.5;

// ── PARTES ────────────────────────────────────────────────────────────────────
export async function getParts({ search, internal, external, height } = {}) {
    const PAGE = 1000;
    let all = [];
    let from = 0;

    while (true) {
        let query = supabase.from('parts').select('*');

        if (search) {
            query = query.or(
                `name.ilike.%${search}%,codigo.ilike.%${search}%,codigo_producto.ilike.%${search}%,aplicacion.ilike.%${search}%`
            );
        }
        if (internal) {
            const v = parseFloat(internal);
            query = query.gte('internal_measure', v - TOLERANCE).lte('internal_measure', v + TOLERANCE);
        }
        if (external) {
            const v = parseFloat(external);
            query = query.gte('external_measure', v - TOLERANCE).lte('external_measure', v + TOLERANCE);
        }
        if (height) {
            const v = parseFloat(height);
            query = query.gte('height', v - TOLERANCE).lte('height', v + TOLERANCE);
        }

        query = query.order('internal_measure').order('external_measure').order('height')
                     .range(from, from + PAGE - 1);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }

    return { message: 'success', data: all };
}

export async function getPartById(id) {
    const { data, error } = await supabase.from('parts').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function createPart(body) {
    const { aplicacion, description, ...rest } = body;
    const finalAplicacion = aplicacion || description || '';
    const { data, error } = await supabase.from('parts').insert({
        ...rest,
        aplicacion: finalAplicacion,
        description: finalAplicacion,
        name: body.codigo_producto || '',
    }).select().single();
    if (error) throw new Error(error.message);

    if ((parseInt(body.stock) || 0) > 0) {
        await supabase.from('stock_movements').insert({
            part_id: data.id,
            type: 'REGISTRO_NUEVO',
            quantity: parseInt(body.stock),
            price: parseFloat(body.cost_price) || 0,
            balance: parseInt(body.stock),
            concept: `Registro manual de producto (${body.stock} unidades iniciales)`,
        });
    }
    return { message: 'success', data };
}

export async function updatePart(id, body) {
    const { aplicacion, description, ...rest } = body;
    const finalAplicacion = aplicacion || description || undefined;
    const { data, error } = await supabase.from('parts').update({
        ...rest,
        ...(finalAplicacion && { aplicacion: finalAplicacion, description: finalAplicacion }),
        ...(body.codigo_producto && { name: body.codigo_producto }),
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function deletePart(id) {
    await supabase.from('stock_movements').delete().eq('part_id', id);
    await supabase.from('sales').delete().eq('part_id', id);
    const { error } = await supabase.from('parts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { message: 'deleted' };
}

export async function restock(partId, quantity) {
    const { data, error } = await supabase.rpc('fn_create_restock', {
        p_part_id: partId,
        p_quantity: quantity,
    });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function exportPartsExcel(parts) {
    const XLSX = await import('xlsx');
    const excelData = parts.map(p => ({
        'FAMILIA':       p.familia || '',
        'CODIGO_PRODUCT': p.codigo_producto || p.name || '',
        'MARCA':         p.marca || '',
        'MUNDIAL':       p.mundial || '',
        'PRECIO BAS':    p.cost_price || 0,
        'PV_GELI':       p.pv_geli || '',
        'STO':           p.stock || 0,
        'MI':            p.internal_measure,
        'ME':            p.external_measure,
        'ALT':           p.height,
        'PES':           p.flange_measure || 0,
        'TOP':           p.tope || 0,
        'APLICACION':    p.aplicacion || '',
        'CODIGO':        p.codigo || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'productos.xlsx');
}

export async function bulkUploadParts(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await import('xlsx');
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const ws = workbook.Sheets[workbook.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(ws);

                const rows = rawRows.map(row => ({
                    familia:          row['FAMILIA'] || row['Familia'] || '',
                    codigo_producto:  row['CODIGO_PRODUCT'] || row['CODIGO_PRODUC'] || '',
                    marca:            row['MARCA'] || row['Marca'] || '',
                    mundial:          row['MUNDIAL'] || row['Mundial'] || '',
                    cost_price:       parseFloat(row['PRECIO BAS'] || row['PRECIO_BAS'] || 0) || 0,
                    pv_geli:          row['PV_GELIPE'] || row['PV GELIPE'] || row['PV_GELI'] || '',
                    stock:            parseInt(row['STO'] || row['Stock'] || 0) || 0,
                    internal_measure: parseFloat(row['MI'] || row['Interna'] || 0) || 0,
                    external_measure: parseFloat(row['ME'] || row['Externa'] || 0) || 0,
                    height:           parseFloat(row['ALT'] || row['Altura'] || 0) || 0,
                    flange_measure:   parseFloat(row['PES'] || row['PE'] || 0) || 0,
                    tope:             parseFloat(row['TOP'] || row['Tope'] || 0) || 0,
                    aplicacion:       row['APLICACION'] || row['Aplicación'] || '',
                    codigo:           row['CODIGO'] || row['Codigo'] || '',
                })).filter(r => r.codigo_producto || r.codigo);

                const { data, error } = await supabase.rpc('fn_bulk_upsert_parts', { p_rows: rows });
                if (error) return reject(new Error(error.message));
                resolve({ message: 'success', imported: data.imported, updated: data.updated });
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// ── KARDEX ────────────────────────────────────────────────────────────────────
export async function getKardex(partId) {
    const { data, error } = await supabase
        .from('stock_movements')
        .select('*, parts(codigo_producto, codigo, name)')
        .eq('part_id', partId)
        .order('created_at');
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

// ── VENTAS ────────────────────────────────────────────────────────────────────
export async function getSales({ date, startDate, endDate } = {}) {
    let query = supabase
        .from('sales')
        .select('*, parts(name, codigo, codigo_producto, aplicacion, cost_price)')
        .order('sale_date');

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    if (!date && !startDate && !endDate) {
        query = query.gte('sale_date', today).lte('sale_date', today + 'T23:59:59.999Z');
    } else if (date === 'today') {
        query = query.gte('sale_date', today).lte('sale_date', today + 'T23:59:59.999Z');
    } else if (date) {
        query = query.gte('sale_date', date).lte('sale_date', date + 'T23:59:59.999Z');
    } else {
        if (startDate) query = query.gte('sale_date', startDate);
        if (endDate)   query = query.lte('sale_date', endDate + 'T23:59:59.999Z');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const flattened = (data || []).map(s => ({
        ...s,
        part_name:       s.parts?.name,
        codigo:          s.parts?.codigo,
        codigo_producto: s.parts?.codigo_producto,
        aplicacion:      s.parts?.aplicacion,
        cost_price:      s.parts?.cost_price,
    }));
    return { message: 'success', data: flattened };
}

export async function getSalesSummary(period = 'today') {
    const { data, error } = await supabase.rpc('fn_get_sales_summary', { p_period: period });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function createSale({ part_id, quantity, unit_price, invoice_type }) {
    const { data, error } = await supabase.rpc('fn_create_sale', {
        p_part_id:      part_id,
        p_quantity:     quantity,
        p_unit_price:   parseFloat(unit_price) || 0,
        p_invoice_type: invoice_type || 'SIN_FACTURA',
    });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function updateSaleInvoiceType(saleId, invoice_type) {
    const { error } = await supabase.from('sales').update({ invoice_type }).eq('id', saleId);
    if (error) throw new Error(error.message);
    return { message: 'success' };
}

export async function returnSale(saleId) {
    const { data, error } = await supabase.rpc('fn_return_sale', { p_sale_id: saleId });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function deleteSale(saleId) {
    const { data, error } = await supabase.rpc('fn_delete_sale', { p_sale_id: saleId });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

// ── MAYORISTA ─────────────────────────────────────────────────────────────────
export async function getWholesaleOrders({ cliente } = {}) {
    let query = supabase.from('wholesale_orders').select('*').order('order_date', { ascending: false });
    if (cliente) query = query.ilike('cliente', `%${cliente}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function getWholesaleOrder(id) {
    const { data: order, error: oErr } = await supabase.from('wholesale_orders').select('*').eq('id', id).single();
    if (oErr) throw new Error(oErr.message);
    const { data: items, error: iErr } = await supabase
        .from('wholesale_items')
        .select('*, parts(codigo_producto, codigo, name, internal_measure, external_measure, height)')
        .eq('order_id', id);
    if (iErr) throw new Error(iErr.message);
    const flatItems = (items || []).map(i => ({ ...i, ...i.parts }));
    return { message: 'success', data: { ...order, items: flatItems } };
}

export async function getPriceHint(partId, cliente) {
    if (!cliente) return { message: 'success', data: null };
    const { data, error } = await supabase
        .from('wholesale_items')
        .select('unit_price, wholesale_orders!inner(order_date, cliente, status)')
        .eq('part_id', partId)
        .eq('wholesale_orders.status', 'active')
        .order('wholesale_orders(order_date)', { ascending: false })
        .limit(5);
    if (error) return { message: 'success', data: null };
    const match = (data || []).find(i =>
        i.wholesale_orders?.cliente?.toLowerCase().includes(cliente.toLowerCase())
    );
    return { message: 'success', data: match ? { unit_price: match.unit_price } : null };
}

export async function createWholesaleOrder({ cliente, items, invoice_type, notes }) {
    const { data, error } = await supabase.rpc('fn_create_wholesale_order', {
        p_cliente:      cliente,
        p_items:        items,
        p_invoice_type: invoice_type || 'SIN_FACTURA',
        p_notes:        notes || '',
    });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function returnWholesaleOrder(orderId) {
    const { data, error } = await supabase.rpc('fn_return_wholesale_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

// ── COTIZACIONES ──────────────────────────────────────────────────────────────
export async function getQuotations() {
    const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('quote_date', { ascending: false });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function getQuotation(id) {
    const { data: quote, error: qErr } = await supabase.from('quotations').select('*').eq('id', id).single();
    if (qErr) throw new Error(qErr.message);
    const { data: items, error: iErr } = await supabase
        .from('quotation_items')
        .select('*, parts(codigo_producto, codigo, name, internal_measure, external_measure, height, marca)')
        .eq('quotation_id', id);
    if (iErr) throw new Error(iErr.message);
    const flatItems = (items || []).map(i => ({ ...i, ...i.parts }));
    return { message: 'success', data: { ...quote, items: flatItems } };
}

export async function createQuotation({ cliente, items, invoice_type, notes, valid_days }) {
    const subtotal = items.reduce((acc, i) => acc + parseFloat(i.unit_price) * parseInt(i.quantity), 0);
    const { data: quote, error } = await supabase.from('quotations').insert({
        cliente:      cliente.trim(),
        subtotal,
        total:        subtotal,
        invoice_type: invoice_type || 'COTIZACION',
        notes:        notes || '',
        valid_days:   valid_days || 7,
    }).select().single();
    if (error) throw new Error(error.message);

    const itemRows = items.map(i => ({
        quotation_id: quote.id,
        part_id:      i.part_id,
        quantity:     parseInt(i.quantity),
        unit_price:   parseFloat(i.unit_price),
        total_price:  parseInt(i.quantity) * parseFloat(i.unit_price),
    }));
    const { error: iErr } = await supabase.from('quotation_items').insert(itemRows);
    if (iErr) throw new Error(iErr.message);
    return { message: 'success', data: { id: quote.id, cliente, subtotal, total: subtotal } };
}

export async function confirmQuotation(id) {
    const { data, error } = await supabase.rpc('fn_confirm_quotation', { p_quote_id: id });
    if (error) throw new Error(error.message);
    return { message: 'success', data };
}

export async function cancelQuotation(id) {
    const { data, error } = await supabase
        .from('quotations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No se pudo cancelar. Ya está confirmada o cancelada.');
    return { message: 'success' };
}

export async function downloadQuotationPdf(id, type = 'cliente') {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const response = await fetch(
        `${supabaseUrl}/functions/v1/quotation-pdf?id=${id}&type=${type}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error generando PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotizacion-${id}-${type}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── STOCK MUERTO ──────────────────────────────────────────────────────────────
export async function getDeadStock(days = 90) {
    const { data: parts, error: pErr } = await supabase
        .from('parts')
        .select('id, codigo_producto, codigo, name, familia, marca, stock, cost_price, internal_measure, external_measure, height, flange_measure, aplicacion')
        .gt('stock', 0);
    if (pErr) throw new Error(pErr.message);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toLocaleDateString('en-CA');

    const { data: recent, error: sErr } = await supabase
        .from('sales')
        .select('part_id')
        .gte('sale_date', cutoffStr);
    if (sErr) throw new Error(sErr.message);

    const active = new Set((recent || []).map(s => s.part_id));
    return { message: 'success', data: (parts || []).filter(p => !active.has(p.id)) };
}

// ── BASE DE DATOS ─────────────────────────────────────────────────────────────
export async function resetDatabase(confirmation) {
    const { data, error } = await supabase.rpc('fn_reset_database', { p_confirmation: confirmation });
    if (error) throw new Error(error.message);
    return data;
}
