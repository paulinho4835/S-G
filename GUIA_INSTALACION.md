# 📦 Guía de Distribución e Instalación - La Casa de los Retenes S&G

¡El sistema **"La casa de los retenes S&G"** ha sido compilado y empaquetado con éxito! Hemos creado ejecutables nativos para Windows de alta calidad, listos para instalarse en cualquier otra computadora sin requerir instalaciones de desarrollo (no se necesita Node.js, SQLite, ni React en la máquina destino).

---

## 🚀 Archivos Generados en `dist_electron/`

Hemos configurado la compilación para generar **dos alternativas de distribución** que se adaptan a cualquier necesidad del cliente:

| Nombre del Archivo | Tipo | Tamaño | Propósito y Ventajas |
| :--- | :--- | :--- | :--- |
| **`La casa de los retenes S&G Setup 1.0.0.exe`** | **Instalador Estándar (NSIS)** | ~78.8 MB | **La opción recomendada para el cliente final.** Proporciona un asistente de instalación profesional, crea accesos directos en el Escritorio y Menú Inicio, y registra la app en Windows para poder desinstalarla fácilmente. |
| **`La casa de los retenes S&G 1.0.0.exe`** | **Ejecutable Portable** | ~78.5 MB | **Ideal para demostraciones rápidas o uso móvil.** Funciona al instante con un solo clic, sin pantallas de instalación. Se puede ejecutar directamente desde una memoria USB (Pendrive) sin dejar rastros en el sistema. |

---

## 🎨 Identidad Visual y Marca Premium
Como parte de esta exportación, hemos diseñado e integrado un **ícono personalizado de alta calidad** (`icon.png`) que representa la esencia del negocio:
*   Un diseño tridimensional y metalizado de un **retén mecánico industrial** con sutiles destellos tecnológicos en azul y verde azulado sobre fondo oscuro.
*   Este ícono aparecerá automáticamente en el acceso directo del escritorio, en la barra de tareas al abrir el programa y en la esquina superior del instalador.

---

## 💾 Persistencia de la Base de Datos (`parts.db`)

Para garantizar que los datos estén completamente seguros y no se pierdan al actualizar o desinstalar la aplicación, el sistema cuenta con un **sistema de migración inteligente de base de datos** en `main.js`:

1.  **Primer Inicio:** Cuando la aplicación se abre por primera vez en una computadora nueva, detecta que no hay base de datos y copia automáticamente la base de datos precargada (`backend/parts.db` con los esquemas y datos iniciales) a la carpeta protegida de datos de usuario de Windows:
    `C:\Users\<NombreUsuario>\AppData\Roaming\felipillo\parts.db`
2.  **Seguridad en Actualizaciones:** Si reinstalas la aplicación o instalas una versión más nueva en el futuro, el programa detectará que ya existe una base de datos de usuario válida y **no la sobrescribirá**, manteniendo intacto todo el inventario, ventas y registros del negocio.
3.  **Restauración:** Si el cliente llegara a corromper la base de datos o desea restaurar el estado original desde cero, el backend Express cuenta con una ruta segura de restauración y copia en `userData`.

---

## 📥 Instrucciones para Instalar en otra Máquina

Para llevar el sistema a la máquina de producción o de tu cliente, sigue estos sencillos pasos:

### Paso 1: Copiar el instalador
Toma el archivo **`La casa de los retenes S&G Setup 1.0.0.exe`** que se encuentra en la carpeta `dist_electron/` y cópialo a:
*   Una memoria USB (Pendrive).
*   Tu almacenamiento en la nube (Google Drive, OneDrive, Dropbox, etc.).
*   O envíalo directamente por correo electrónico o red local.

### Paso 2: Ejecutar el Instalador
En la computadora destino:
1.  Haz doble clic sobre el archivo **`La casa de los retenes S&G Setup 1.0.0.exe`**.
2.  Aparecerá el asistente de instalación interactivo:
    *   Te preguntará si deseas instalar el programa en tu carpeta local o en una ruta personalizada.
    *   Puedes marcar la casilla para **Crear un acceso directo en el Escritorio**.
3.  Haz clic en **Siguiente** e **Instalar**. El proceso toma menos de 10 segundos.

### Paso 3: ¡Listo para Usar!
*   Se abrirá la aplicación automáticamente al finalizar la instalación.
*   Encontrarás el ícono de la aplicación en el Escritorio llamado **"La Casa de los Retenes S&G"**.
*   El backend y el frontend se iniciarán de forma completamente transparente y silenciosa en segundo plano cada vez que abras el programa.

---

## 📊 Carga Masiva desde Excel (Offline)
El sistema está 100% preparado para trabajar de forma local. Para realizar una carga masiva desde Excel, asegúrate de que la hoja de cálculo tenga exactamente las siguientes columnas en la primera fila (los encabezados):
`FAMILIA` | `CODIGO_PRODUCT` | `MARCA` | `MUNDIAL` | `PRECIO BAS` | `PV_GELI` | `STO` | `MI` | `ME` | `ALT` | `PES` | `TOP` | `APLICACION` | `CODIGO`

El importador procesará de forma nativa e instantánea miles de productos de una sola vez guardándolos directamente en la base de datos SQLite integrada.

---

> [!TIP]
> **¿Cómo realizar mantenimiento o respaldos manuales de la base de datos?**
> Para hacer una copia de seguridad rápida de todo el inventario y las ventas, simplemente dile al cliente que copie el archivo `parts.db` ubicado en `C:\Users\<NombreUsuario>\AppData\Roaming\felipillo\parts.db` y lo guarde en un lugar seguro. Para restaurar el respaldo en otra máquina, solo debe pegar ese mismo archivo en esa misma ruta.
