# ARQ Market Scanner

**ARQ Market Scanner** es una página web de análisis técnico para acciones y ETFs de Estados Unidos.  
El sistema genera un ranking automático con probabilidad técnica estimada, fuerza relativa, momentum, riesgo, zona de entrada, stop loss, objetivo y señal operativa.

> **Aviso importante:** este proyecto es una herramienta educativa y de apoyo al análisis. No constituye asesoría financiera ni garantiza ganancias. Toda operación en el mercado implica riesgo.

---

## Vista general

La página está diseñada para identificar oportunidades técnicas en acciones populares del mercado estadounidense usando datos descargados automáticamente y un sistema de puntuación propio.

El análisis combina indicadores técnicos, condición general del mercado y criterios de riesgo para clasificar cada activo en señales como:

- **COMPRA FUERTE**
- **POSIBLE COMPRA**
- **VIGILAR**
- **NO COMPRAR**

---

## Características principales

- Ranking automático de acciones y ETFs.
- Actualización automática mediante GitHub Actions.
- Refresco visual de la página sin intervención manual.
- Análisis del mercado general usando referencias como SPY y QQQ.
- Cálculo de probabilidad técnica estimada.
- Medición de momentum a 5 días.
- Fuerza relativa frente al mercado.
- RSI, medias móviles, ATR y volatilidad.
- Zona técnica de entrada.
- Stop loss y objetivo estimado.
- Relación riesgo/beneficio.
- Clasificación de riesgo: bajo, medio o alto.
- Filtros por sector, señal, HOT score y riesgo.
- Reloj en vivo con hora de Colombia.
- Diseño responsive para escritorio y celular.

---

## Cómo funciona

El flujo general del proyecto es:

```text
GitHub Actions
      ↓
Ejecuta analizador_acciones.py
      ↓
Descarga y analiza datos del mercado
      ↓
Genera datos_acciones.json
      ↓
GitHub Pages publica la página
      ↓
index.html + script.js muestran el ranking
```

La página no ejecuta Python directamente en el navegador.  
El análisis se genera previamente en GitHub Actions y luego la página lee el archivo `datos_acciones.json`.

---

## Actualización automática

El workflow de GitHub Actions está configurado para ejecutarse automáticamente cada 5 minutos en horario de mercado aproximado.

La programación evita correr exactamente en el minuto `00` para reducir retrasos en GitHub:

```yaml
cron: "2-59/5 13-21 * * 1-5"
```

Esto significa:

- Lunes a viernes.
- Cada 5 minutos.
- En una franja horaria aproximada de mercado.
- Minutos: `02, 07, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57`.

También se usa `concurrency` para evitar que se acumulen ejecuciones si una corrida tarda más de lo esperado.

---

## Archivos principales

```text
.github/workflows/analizar.yml   # Automatización de GitHub Actions
analizador_acciones.py           # Motor de análisis técnico
datos_acciones.json              # Datos procesados que consume la página
index.html                       # Estructura principal de la página
script.js                        # Lógica visual, filtros y carga de datos
style.css                        # Estilos visuales de la interfaz
README.md                        # Documentación del proyecto
```

---

## Indicadores usados

El sistema evalúa varios factores técnicos, entre ellos:

- Precio actual.
- Medias móviles.
- RSI.
- MACD.
- ATR.
- ATR porcentual.
- Momentum a 5 días.
- Volumen relativo.
- Fuerza relativa.
- Condición general del mercado.
- Riesgo por volatilidad.
- Extensión del precio frente a medias móviles.

Estos factores se combinan para generar una probabilidad técnica estimada y una señal.

---

## Interpretación de señales

### COMPRA FUERTE

Indica que varios indicadores técnicos están alineados positivamente.  
No significa compra garantizada; debe confirmarse con gestión de riesgo.

### POSIBLE COMPRA

La acción presenta condiciones favorables, pero con menor fuerza o confirmación que una compra fuerte.

### VIGILAR

La acción puede estar en desarrollo, pero todavía no cumple suficientes condiciones para entrada.

### NO COMPRAR

La acción no cumple criterios técnicos suficientes o presenta riesgo elevado.

---

## Gestión de riesgo

El sistema muestra:

- **Entrada:** zona estimada donde la operación puede tener mejor relación riesgo/beneficio.
- **Stop loss:** nivel técnico para limitar pérdidas.
- **Objetivo:** precio técnico estimado.
- **R/R:** relación riesgo/beneficio.
- **Riesgo:** bajo, medio o alto según volatilidad, RSI, momentum y extensión del precio.

> Ningún stop loss ni objetivo es perfecto. El mercado puede abrir con gaps, moverse rápido o invalidar una señal.

---

## Requisitos técnicos

El proyecto usa:

- HTML
- CSS
- JavaScript
- Python
- GitHub Pages
- GitHub Actions
- yfinance
- pandas
- openpyxl

---

## Ejecución local opcional

Para ejecutar el análisis en una computadora local:

```bash
pip install yfinance pandas openpyxl
python analizador_acciones.py
```

Esto generará o actualizará:

```text
datos_acciones.json
```

Luego puedes abrir `index.html` en el navegador para ver la página.

---

## Publicación en GitHub Pages

Para usar el proyecto en GitHub Pages:

1. Subir los archivos a un repositorio público.
2. Activar GitHub Pages desde la rama principal.
3. Verificar que el workflow `analizar.yml` esté en:

```text
.github/workflows/analizar.yml
```

4. Ejecutar manualmente una primera vez desde:

```text
Actions → Analizar acciones → Run workflow
```

Después de eso, el sistema debe actualizarse automáticamente.

---

## Buenas prácticas

- Revisar que GitHub Actions termine en verde.
- No operar solo por una señal automática.
- Confirmar noticias relevantes antes de entrar.
- No usar dinero que no se pueda perder.
- Evitar operar acciones con riesgo alto sin experiencia.
- Ajustar la frecuencia de actualización según necesidad.
- Reducir la retención de logs en GitHub si se generan muchas ejecuciones.

---

## Estado del proyecto

Versión actual:

```text
ARQ Market Scanner
Actualización automática: cada 5 minutos
Modo: análisis técnico sin bot de trading
Historial de operaciones: no incluido
Trading automático: no incluido
```

---

## Próximas mejoras posibles

- Integración con noticias financieras.
- Backtesting histórico.
- Historial de señales.
- Alertas automáticas.
- Conexión con broker en modo paper trading.
- Dashboard de rendimiento.
- Integración futura con API de mercado en tiempo real.

---

## Licencia y uso

Proyecto personal para análisis técnico y aprendizaje.  
El usuario es responsable de cualquier decisión de inversión tomada con base en la información mostrada.
