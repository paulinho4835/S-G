# Guía de Instalación - Spare Parts Store

Este proyecto consta de dos partes: un **Backend** (Node.js + SQLite) y un **Frontend** (React + Vite). Sigue los pasos a continuación para configurar ambos.

## Requisitos Previos

- Tener instalado **Node.js** (versión 18 o superior recomendada).
- Tener instalado **npm** (viene con Node.js).

---

## 1. Configuración del Backend

El servidor maneja la base de datos y la API.

1. Abre una terminal y navega a la carpeta `backend`:
   ```bash
   cd backend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor:
   ```bash
   npm start
   ```
   > El servidor iniciará en **http://localhost:3001**

   *Alternativa para desarrollo (reinicia al guardar cambios):*
   ```bash
   npm run dev
   ```

---

## 2. Configuración del Frontend

La interfaz de usuario está construida con React y Vite.

1. Abre una **nueva** terminal (mantén la del backend corriendo) y navega a la carpeta `frontend`:
   ```bash
   cd frontend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Verás una URL en la terminal (usualmente **http://localhost:5173**). Abre ese enlace en tu navegador para usar la aplicación.

---

## Resumen de Comandos

| Componente | Carpeta    | Instalar      | Iniciar       | Puerto |
|------------|------------|---------------|---------------|--------|
| Backend    | `backend`  | `npm install` | `npm start`   | 3001   |
| Frontend   | `frontend` | `npm install` | `npm run dev` | 5173*  |

*El puerto del frontend puede variar si el 5173 está ocupado, revisa la terminal.*
