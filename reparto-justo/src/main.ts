import './estilo.css'
import {
  CONFIG,
  ajustarAsignacion,
  asignar,
  confirmarRonda,
  crearEstadoInicial,
  reiniciarJuego,
  type ComunidadId,
  type EstadoJuego,
  type Recurso,
} from "./logica";

const app = (() => {
  const contenedor = document.querySelector<HTMLDivElement>("#app");

  if (contenedor === null) {
    throw new Error('No se encontró el contenedor principal "#app".');
  }

  return contenedor;
})();

let estado: EstadoJuego | undefined;
let mensaje = "";

const nombresRecursos: Record<Recurso, string> = {
  agua: "Agua",
  comida: "Comida",
  medicina: "Medicina",
};

const nombresComunidades: Record<ComunidadId, string> = {
  norte: "Comunidad Norte",
  sur: "Comunidad Sur",
  este: "Comunidad Este",
  oeste: "Comunidad Oeste",
};

const recursos: Recurso[] = ["agua", "comida", "medicina"];
const comunidades: ComunidadId[] = ["norte", "sur", "este", "oeste"];

function dibujarInicio(): void {
  app.innerHTML = `
    <main class="pantalla pantalla-inicio">
      <header class="encabezado">
        <p class="sobrelinea">Simulador de asistencia comunitaria</p>
        <h1>Reparto <span>Justo</span></h1>
        <p class="introduccion">
          Distribuí agua, comida y medicina entre cuatro comunidades.
          Cada decisión ayuda a sostenerlas durante ${CONFIG.RONDAS_TOTALES} rondas.
        </p>
      </header>

      <section class="resumen-inicio" aria-label="Resumen de la simulación">
        <article class="dato-inicio">
          <span class="numero-inicio">4</span>
          <span>comunidades</span>
        </article>
        <article class="dato-inicio">
          <span class="numero-inicio">${CONFIG.RONDAS_TOTALES}</span>
          <span>rondas</span>
        </article>
        <article class="dato-inicio">
          <span class="numero-inicio">3</span>
          <span>recursos esenciales</span>
        </article>
      </section>

      <button class="boton boton-principal boton-inicio" type="button" data-accion="iniciar">
        Iniciar reparto
      </button>
      <p class="ayuda-inicio">Usá los botones o el teclado para preparar cada asignación.</p>
    </main>
  `;
}

function claseEstadoSoporte(soporte: number): string {
  if (soporte < CONFIG.UMBRAL_CRITICO) {
    return "critico";
  }

  if (soporte < CONFIG.UMBRAL_ACEPTABLE) {
    return "alerta";
  }

  return "satisfecho";
}

function textoEstadoSoporte(soporte: number): string {
  if (soporte < CONFIG.UMBRAL_CRITICO) {
    return "Crítico";
  }

  if (soporte < CONFIG.UMBRAL_ACEPTABLE) {
    return "Alerta";
  }

  return "Aceptable";
}

function dibujarInventario(actual: EstadoJuego): string {
  return recursos
    .map(
      (recurso) => `
        <article class="inventario-item recurso-${recurso}">
          <span class="inventario-nombre">${nombresRecursos[recurso]}</span>
          <strong class="inventario-cantidad">${actual.inventario[recurso]}</strong>
          <span class="inventario-unidad">unidades</span>
        </article>
      `,
    )
    .join("");
}

function dibujarControl(
  actual: EstadoJuego,
  comunidadId: ComunidadId,
  recurso: Recurso,
): string {
  const comunidad = actual.comunidades.find((item) => item.id === comunidadId);

  if (comunidad === undefined) {
    return "";
  }

  return `
    <div class="control-recurso recurso-${recurso}">
      <span class="nombre-recurso">${nombresRecursos[recurso]}</span>
      <div class="control-cantidad">
        <button
          class="boton-cantidad"
          type="button"
          data-accion="ajustar"
          data-comunidad="${comunidadId}"
          data-recurso="${recurso}"
          data-cambio="-1"
          aria-label="Quitar una unidad de ${nombresRecursos[recurso]} para ${nombresComunidades[comunidadId]}"
        >−</button>
        <input
          class="entrada-cantidad"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          value="${comunidad.asignacion[recurso]}"
          data-entrada="asignar"
          data-comunidad="${comunidadId}"
          data-recurso="${recurso}"
          aria-label="Unidades de ${nombresRecursos[recurso]} para ${nombresComunidades[comunidadId]}"
        />
        <button
          class="boton-cantidad"
          type="button"
          data-accion="ajustar"
          data-comunidad="${comunidadId}"
          data-recurso="${recurso}"
          data-cambio="1"
          aria-label="Agregar una unidad de ${nombresRecursos[recurso]} para ${nombresComunidades[comunidadId]}"
        >+</button>
      </div>
      <span class="necesidad">Necesita ${comunidad.necesidades[recurso]}</span>
    </div>
  `;
}

function dibujarComunidad(actual: EstadoJuego, comunidadId: ComunidadId): string {
  const comunidad = actual.comunidades.find((item) => item.id === comunidadId);

  if (comunidad === undefined) {
    return "";
  }

  const claseSoporte = claseEstadoSoporte(comunidad.soporte);
  const soporteAccesible = Math.min(
    CONFIG.SOPORTE_MAXIMO,
    Math.max(CONFIG.SOPORTE_MINIMO, comunidad.soporte),
  );

  return `
    <article class="tarjeta-comunidad estado-${claseSoporte}">
      <header class="cabecera-comunidad">
        <div>
          <p class="etiqueta-comunidad">Comunidad ${comunidadId}</p>
          <h3>${comunidad.nombre}</h3>
        </div>
        <span class="insignia-estado">${textoEstadoSoporte(comunidad.soporte)}</span>
      </header>

      <div class="resumen-soporte">
        <div class="soporte-etiqueta">
          <span>Soporte</span>
          <strong>${comunidad.soporte}<span> / ${CONFIG.SOPORTE_MAXIMO}</span></strong>
        </div>
        <progress
          class="barra-soporte"
          value="${soporteAccesible}"
          max="${CONFIG.SOPORTE_MAXIMO}"
          aria-label="Soporte de ${comunidad.nombre}: ${comunidad.soporte} de ${CONFIG.SOPORTE_MAXIMO}"
        ></progress>
      </div>

      <div class="asignaciones">
        <h4>Asignación para esta ronda</h4>
        ${recursos
          .map((recurso) => dibujarControl(actual, comunidadId, recurso))
          .join("")}
      </div>
    </article>
  `;
}

function dibujarPartida(actual: EstadoJuego): void {
  app.innerHTML = `
    <main class="pantalla pantalla-partida">
      <header class="barra-superior">
        <a class="marca" href="#" data-accion="inicio" aria-label="Volver al inicio">Reparto <span>Justo</span></a>
        <p class="contador-ronda">
          Ronda <strong>${actual.ronda}</strong>
          <span>de ${CONFIG.RONDAS_TOTALES}</span>
        </p>
      </header>

      <section class="cabecera-partida">
        <div>
          <p class="sobrelinea">Coordinación logística</p>
          <h1>Prepará el reparto</h1>
          <p>Asigná los recursos según las necesidades y el soporte de cada comunidad.</p>
        </div>
        <button class="boton boton-secundario" type="button" data-accion="reiniciar">
          Reiniciar
        </button>
      </section>

      <section class="panel-inventario" aria-labelledby="titulo-inventario">
        <div class="titulo-seccion">
          <div>
            <p class="sobrelinea">Recursos disponibles</p>
            <h2 id="titulo-inventario">Inventario</h2>
          </div>
          <span class="nota-inventario">Las cantidades se descuentan al confirmar</span>
        </div>
        <div class="inventario-lista">${dibujarInventario(actual)}</div>
      </section>

      <section class="seccion-comunidades" aria-labelledby="titulo-comunidades">
        <div class="titulo-seccion">
          <div>
            <p class="sobrelinea">Estado y necesidades</p>
            <h2 id="titulo-comunidades">Comunidades</h2>
          </div>
          <p class="nota-soporte">Cada ronda reduce el soporte en ${CONFIG.DESGASTE_POR_RONDA} puntos.</p>
        </div>
        <div class="lista-comunidades">
          ${comunidades.map((id) => dibujarComunidad(actual, id)).join("")}
        </div>
      </section>

      <footer class="pie-partida">
        <p class="mensaje" role="status" aria-live="polite">${mensaje}</p>
        <button class="boton boton-principal" type="button" data-accion="confirmar">
          Confirmar ronda
        </button>
      </footer>
    </main>
  `;
}

function dibujarFinal(actual: EstadoJuego): void {
  const gano = actual.resultado === "victoria";
  const comunidadesFinales = actual.comunidades
    .map((comunidad) => {
      const claseSoporte = claseEstadoSoporte(comunidad.soporte);

      return `
        <li class="resultado-comunidad estado-${claseSoporte}">
          <span>${comunidad.nombre}</span>
          <strong>${comunidad.soporte} / ${CONFIG.SOPORTE_MAXIMO} · ${textoEstadoSoporte(comunidad.soporte)}</strong>
        </li>
      `;
    })
    .join("");

  app.innerHTML = `
    <main class="pantalla pantalla-final">
      <section class="tarjeta-final ${gano ? "final-victoria" : "final-derrota"}">
        <p class="sobrelinea">${gano ? "Simulación completada" : "Simulación finalizada"}</p>
        <h1>${gano ? "Reparto logrado" : "El reparto terminó"}</h1>
        <p class="mensaje-final">
          ${
            gano
              ? "Completaste todas las rondas y las cuatro comunidades conservaron un soporte aceptable."
              : "No se pudieron sostener las condiciones necesarias para completar la distribución."
          }
        </p>
        <h2>Estado final de las comunidades</h2>
        <ul class="lista-final">${comunidadesFinales}</ul>
        <button class="boton boton-principal" type="button" data-accion="reiniciar-final">
          Jugar de nuevo
        </button>
      </section>
    </main>
  `;
}

function dibujar(): void {
  if (estado === undefined) {
    dibujarInicio();
    return;
  }

  if (estado.resultado !== "en-curso") {
    dibujarFinal(estado);
    return;
  }

  dibujarPartida(estado);
}

function esComunidadId(valor: string | undefined): valor is ComunidadId {
  return valor !== undefined && comunidades.includes(valor as ComunidadId);
}

function esRecurso(valor: string | undefined): valor is Recurso {
  return valor !== undefined && recursos.includes(valor as Recurso);
}

function manejarClic(evento: MouseEvent): void {
  if (!(evento.target instanceof Element)) {
    return;
  }

  const boton = evento.target.closest<HTMLButtonElement | HTMLAnchorElement>(
    "[data-accion]",
  );

  if (boton === null) {
    return;
  }

  evento.preventDefault();
  const accion = boton.dataset.accion;

  if (accion === "iniciar") {
    estado = crearEstadoInicial();
    mensaje = "";
    dibujar();
    return;
  }

  if (accion === "inicio") {
    estado = undefined;
    mensaje = "";
    dibujar();
    return;
  }

  if (accion === "reiniciar" || accion === "reiniciar-final") {
    if (estado === undefined) {
      return;
    }

    const resultado = reiniciarJuego(estado);
    mensaje = resultado ? "" : "No se pudo reiniciar la simulación.";
    dibujar();
    return;
  }

  if (accion === "confirmar") {
    if (estado === undefined) {
      return;
    }

    const resultado = confirmarRonda(estado);
    mensaje = resultado ? "" : "No se pudo confirmar la ronda.";
    dibujar();
    return;
  }

  if (accion === "ajustar") {
    if (estado === undefined) {
      return;
    }

    const id = boton.dataset.comunidad;
    const recurso = boton.dataset.recurso;
    const cambio = Number(boton.dataset.cambio);

    if (!esComunidadId(id) || !esRecurso(recurso) || !Number.isInteger(cambio)) {
      return;
    }

    const resultado = ajustarAsignacion(estado, id, recurso, cambio);
    mensaje = resultado ? "" : "Esa cantidad no se puede asignar.";
    dibujar();
  }
}

function manejarCambio(evento: Event): void {
  if (!(evento.target instanceof HTMLInputElement)) {
    return;
  }

  const entrada = evento.target;

  if (entrada.dataset.entrada !== "asignar" || estado === undefined) {
    return;
  }

  const id = entrada.dataset.comunidad;
  const recurso = entrada.dataset.recurso;
  const cantidad = Number(entrada.value);

  if (!esComunidadId(id) || !esRecurso(recurso)) {
    return;
  }

  const resultado = asignar(estado, id, recurso, cantidad);
  mensaje = resultado ? "" : "Esa cantidad no se puede asignar.";
  dibujar();
}

app.addEventListener("click", manejarClic);
app.addEventListener("change", manejarCambio);
dibujar();
