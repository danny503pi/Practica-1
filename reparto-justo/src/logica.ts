export const CONFIG = {
  RONDAS_TOTALES: 5, // rondas
  SOPORTE_INICIAL: 50, // puntos de soporte
  SOPORTE_MINIMO: 0, // puntos de soporte
  SOPORTE_MAXIMO: 100, // puntos de soporte
  UMBRAL_ACEPTABLE: 40, // puntos de soporte
  UMBRAL_CRITICO: 20, // puntos de soporte; por debajo se pierde
  SOPORTE_POR_UNIDAD: 10, // puntos de soporte por unidad asignada
  DESGASTE_POR_RONDA: 15, // puntos de soporte por ronda
  INVENTARIO_INICIAL_POR_RECURSO: 20, // unidades por recurso
  SEMILLA_PREDETERMINADA: 1, // valor entero de semilla
  DEMANDA_MINIMA_ALEATORIA: 0, // unidades por recurso y comunidad
  DEMANDA_MAXIMA_ALEATORIA: 2, // unidades por recurso y comunidad
  NECESIDADES_INICIALES: [
    { agua: 2, comida: 1, medicina: 1 },
    { agua: 1, comida: 2, medicina: 1 },
    { agua: 1, comida: 1, medicina: 2 },
    { agua: 2, comida: 2, medicina: 1 },
  ], // unidades de demanda por recurso, en el orden de las comunidades
  GENERADOR_MULTIPLICADOR: 1664525, // factor del generador seudoaleatorio
  GENERADOR_INCREMENTO: 1013904223, // incremento del generador seudoaleatorio
  GENERADOR_MODULO: 4294967296, // estados posibles del generador
} as const;

export type Recurso = "agua" | "comida" | "medicina";
export type ComunidadId = "norte" | "sur" | "este" | "oeste";
export type ResultadoJuego = "en-curso" | "victoria" | "derrota";

export interface CantidadesRecursos {
  agua: number;
  comida: number;
  medicina: number;
}

export interface Comunidad {
  id: ComunidadId;
  nombre: string;
  soporte: number;
  necesidades: CantidadesRecursos;
  asignacion: CantidadesRecursos;
}

export interface EstadoJuego {
  ronda: number;
  inventario: CantidadesRecursos;
  comunidades: Comunidad[];
  resultado: ResultadoJuego;
  semilla: number;
}

const COMUNIDADES: ReadonlyArray<Pick<Comunidad, "id" | "nombre">> = [
  { id: "norte", nombre: "Comunidad Norte" },
  { id: "sur", nombre: "Comunidad Sur" },
  { id: "este", nombre: "Comunidad Este" },
  { id: "oeste", nombre: "Comunidad Oeste" },
];

const RECURSOS: readonly Recurso[] = ["agua", "comida", "medicina"];

function normalizarSemilla(semilla: number): number {
  return ((semilla % CONFIG.GENERADOR_MODULO) + CONFIG.GENERADOR_MODULO) %
    CONFIG.GENERADOR_MODULO;
}

function siguienteValorAleatorio(semilla: number): {
  valor: number;
  semilla: number;
} {
  const nuevaSemilla =
    (Math.imul(semilla, CONFIG.GENERADOR_MULTIPLICADOR) +
      CONFIG.GENERADOR_INCREMENTO) >>>
    0;

  return {
    valor: nuevaSemilla / CONFIG.GENERADOR_MODULO,
    semilla: nuevaSemilla,
  };
}

export function crearGeneradorConSemilla(semilla: number): () => number {
  let estado = normalizarSemilla(semilla);

  return () => {
    const siguiente = siguienteValorAleatorio(estado);
    estado = siguiente.semilla;
    return siguiente.valor;
  };
}

function crearCantidades(agua: number, comida: number, medicina: number): CantidadesRecursos {
  return { agua, comida, medicina };
}

function crearNecesidadesAleatorias(estado: EstadoJuego): CantidadesRecursos[] {
  const rango =
    CONFIG.DEMANDA_MAXIMA_ALEATORIA - CONFIG.DEMANDA_MINIMA_ALEATORIA + 1;

  return COMUNIDADES.map(() => {
    const necesidades = crearCantidades(0, 0, 0);

    for (const recurso of RECURSOS) {
      const siguiente = siguienteValorAleatorio(estado.semilla);
      estado.semilla = siguiente.semilla;
      necesidades[recurso] =
        CONFIG.DEMANDA_MINIMA_ALEATORIA + Math.floor(siguiente.valor * rango);
    }

    return necesidades;
  });
}

function encontrarComunidad(
  estado: EstadoJuego,
  comunidadId: ComunidadId,
): Comunidad | undefined {
  return estado.comunidades.find((comunidad) => comunidad.id === comunidadId);
}

function esCantidadValida(cantidad: number): boolean {
  return Number.isInteger(cantidad) && cantidad >= 0;
}

function inventarioAgotado(estado: EstadoJuego): boolean {
  return RECURSOS.every((recurso) => estado.inventario[recurso] === 0);
}

function hayNecesidadesUrgentes(estado: EstadoJuego): boolean {
  return estado.comunidades.some(
    (comunidad) =>
      comunidad.soporte < CONFIG.UMBRAL_ACEPTABLE &&
      RECURSOS.some((recurso) => comunidad.necesidades[recurso] > 0),
  );
}

function hayComunidadEnEstadoCritico(estado: EstadoJuego): boolean {
  return estado.comunidades.some(
    (comunidad) => comunidad.soporte < CONFIG.UMBRAL_CRITICO,
  );
}

export function crearEstadoInicial(
  semilla: number = CONFIG.SEMILLA_PREDETERMINADA,
): EstadoJuego {
  if (!Number.isInteger(semilla)) {
    throw new RangeError("La semilla debe ser un número entero.");
  }

  return {
    ronda: 1,
    inventario: crearCantidades(
      CONFIG.INVENTARIO_INICIAL_POR_RECURSO,
      CONFIG.INVENTARIO_INICIAL_POR_RECURSO,
      CONFIG.INVENTARIO_INICIAL_POR_RECURSO,
    ),
    comunidades: COMUNIDADES.map((comunidad, indice) => ({
      ...comunidad,
      soporte: CONFIG.SOPORTE_INICIAL,
      necesidades: { ...CONFIG.NECESIDADES_INICIALES[indice] },
      asignacion: crearCantidades(0, 0, 0),
    })),
    resultado: "en-curso",
    semilla: normalizarSemilla(semilla),
  };
}

export function asignar(
  estado: EstadoJuego,
  comunidadId: ComunidadId,
  recurso: Recurso,
  cantidad: number,
): boolean {
  const comunidad = encontrarComunidad(estado, comunidadId);

  if (
    estado.resultado !== "en-curso" ||
    comunidad === undefined ||
    !RECURSOS.includes(recurso) ||
    !esCantidadValida(cantidad) ||
    cantidad > comunidad.necesidades[recurso]
  ) {
    return false;
  }

  const asignadoEnOtrasComunidades = estado.comunidades.reduce(
    (total, elemento) =>
      total +
      (elemento.id === comunidadId ? 0 : elemento.asignacion[recurso]),
    0,
  );

  if (
    asignadoEnOtrasComunidades + cantidad >
    estado.inventario[recurso]
  ) {
    return false;
  }

  comunidad.asignacion[recurso] = cantidad;
  return true;
}

export function ajustarAsignacion(
  estado: EstadoJuego,
  comunidadId: ComunidadId,
  recurso: Recurso,
  cambio: number,
): boolean {
  const comunidad = encontrarComunidad(estado, comunidadId);

  if (
    comunidad === undefined ||
    !Number.isInteger(cambio) ||
    estado.resultado !== "en-curso" ||
    !RECURSOS.includes(recurso)
  ) {
    return false;
  }

  return asignar(
    estado,
    comunidadId,
    recurso,
    comunidad.asignacion[recurso] + cambio,
  );
}

export function confirmarRonda(estado: EstadoJuego): boolean {
  if (estado.resultado !== "en-curso" || estado.ronda > CONFIG.RONDAS_TOTALES) {
    return false;
  }

  for (const recurso of RECURSOS) {
    const totalAsignado = estado.comunidades.reduce(
      (total, comunidad) => total + comunidad.asignacion[recurso],
      0,
    );

    if (totalAsignado > estado.inventario[recurso]) {
      return false;
    }
  }

  for (const comunidad of estado.comunidades) {
    for (const recurso of RECURSOS) {
      const cantidad = comunidad.asignacion[recurso];
      estado.inventario[recurso] -= cantidad;
      comunidad.necesidades[recurso] -= cantidad;
      comunidad.soporte = Math.min(
        CONFIG.SOPORTE_MAXIMO,
        comunidad.soporte + cantidad * CONFIG.SOPORTE_POR_UNIDAD,
      );
      comunidad.asignacion[recurso] = 0;
    }

    comunidad.soporte = Math.max(
      CONFIG.SOPORTE_MINIMO,
      comunidad.soporte - CONFIG.DESGASTE_POR_RONDA,
    );
  }

  if (hayComunidadEnEstadoCritico(estado)) {
    estado.resultado = "derrota";
    return true;
  }

  if (estado.ronda === CONFIG.RONDAS_TOTALES) {
    estado.resultado = estado.comunidades.every(
      (comunidad) => comunidad.soporte >= CONFIG.UMBRAL_ACEPTABLE,
    )
      ? "victoria"
      : "derrota";
    return true;
  }

  estado.ronda += 1;
  const nuevasNecesidades = crearNecesidadesAleatorias(estado);

  estado.comunidades.forEach((comunidad, indice) => {
    comunidad.necesidades = nuevasNecesidades[indice];
  });

  if (inventarioAgotado(estado) && hayNecesidadesUrgentes(estado)) {
    estado.resultado = "derrota";
  }

  return true;
}

export function reiniciarJuego(
  estado: EstadoJuego,
  semilla: number = CONFIG.SEMILLA_PREDETERMINADA,
): boolean {
  if (!Number.isInteger(semilla)) {
    return false;
  }

  Object.assign(estado, crearEstadoInicial(semilla));
  return true;
}
