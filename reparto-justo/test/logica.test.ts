import { describe, expect, it } from "vitest";
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
} from "../src/logica";

describe("Reglas de Reparto Justo", () => {
  it("arma el estado inicial con cuatro comunidades e inventario completo", () => {
    const estado = crearEstadoInicial();

    expect(estado.ronda).toBe(1);
    expect(estado.resultado).toBe("en-curso");
    expect(estado.inventario).toEqual({ agua: 20, comida: 20, medicina: 20 });
    expect(estado.comunidades.map(({ nombre }) => nombre)).toEqual([
      "Comunidad Norte",
      "Comunidad Sur",
      "Comunidad Este",
      "Comunidad Oeste",
    ]);
    expect(estado.comunidades.map(({ soporte }) => soporte)).toEqual([
      CONFIG.SOPORTE_INICIAL,
      CONFIG.SOPORTE_INICIAL,
      CONFIG.SOPORTE_INICIAL,
      CONFIG.SOPORTE_INICIAL,
    ]);
    expect(estado.comunidades.every(({ necesidades, asignacion }) =>
      Object.values(necesidades).some((cantidad) => cantidad > 0) &&
      Object.values(asignacion).every((cantidad) => cantidad === 0),
    )).toBe(true);
  });

  it("asigna una cantidad válida y rechaza una cantidad negativa", () => {
    const estado = crearEstadoInicial();

    expect(asignar(estado, "norte", "agua", 1)).toBe(true);
    expect(estado.comunidades[0].asignacion.agua).toBe(1);
    expect(asignar(estado, "norte", "agua", -1)).toBe(false);
    expect(estado.comunidades[0].asignacion.agua).toBe(1);
  });

  it("ajusta la asignación con cambios válidos y rechaza exceder la necesidad", () => {
    const estado = crearEstadoInicial();

    expect(ajustarAsignacion(estado, "norte", "agua", 1)).toBe(true);
    expect(ajustarAsignacion(estado, "norte", "agua", 1)).toBe(true);
    expect(ajustarAsignacion(estado, "norte", "agua", 1)).toBe(false);
    expect(ajustarAsignacion(estado, "norte", "agua", -3)).toBe(false);
    expect(estado.comunidades[0].asignacion.agua).toBe(2);
  });

  it("confirma una ronda válida y aplica reparto, desgaste e inventario", () => {
    const estado = crearEstadoInicial();
    const comunidad = estado.comunidades[0];

    expect(asignar(estado, "norte", "agua", 1)).toBe(true);
    expect(confirmarRonda(estado)).toBe(true);
    expect(estado.inventario.agua).toBe(19);
    expect(comunidad.soporte).toBe(
      CONFIG.SOPORTE_INICIAL +
        CONFIG.SOPORTE_POR_UNIDAD -
        CONFIG.DESGASTE_POR_RONDA,
    );
    expect(comunidad.asignacion.agua).toBe(0);
    expect(estado.ronda).toBe(2);
  });

  it("rechaza asignar más recursos que el inventario disponible", () => {
    const estado = crearEstadoInicial();
    estado.inventario.agua = 1;

    expect(asignar(estado, "norte", "agua", 1)).toBe(true);
    expect(asignar(estado, "sur", "agua", 1)).toBe(false);
    expect(estado.comunidades[1].asignacion.agua).toBe(0);
  });

  it("declara la derrota cuando una comunidad cae debajo del soporte crítico", () => {
    const estado = crearEstadoInicial();
    estado.comunidades[0].soporte = CONFIG.UMBRAL_CRITICO;

    expect(confirmarRonda(estado)).toBe(true);
    expect(estado.comunidades[0].soporte).toBe(
      CONFIG.UMBRAL_CRITICO - CONFIG.DESGASTE_POR_RONDA,
    );
    expect(estado.resultado).toBe("derrota");
    expect(asignar(estado, "norte", "agua", 1)).toBe(false);
    expect(confirmarRonda(estado)).toBe(false);
  });

  it("declara la derrota si se agota el inventario con necesidades urgentes pendientes", () => {
    const estado = crearEstadoInicial();
    estado.inventario = { agua: 0, comida: 0, medicina: 0 };

    expect(confirmarRonda(estado)).toBe(true);
    expect(estado.resultado).toBe("derrota");
  });

  it("declara la victoria al completar la última ronda con soporte aceptable", () => {
    const estado = crearEstadoInicial();
    estado.ronda = CONFIG.RONDAS_TOTALES;
    estado.comunidades.forEach((comunidad) => {
      comunidad.soporte = CONFIG.UMBRAL_ACEPTABLE + CONFIG.DESGASTE_POR_RONDA;
    });

    expect(confirmarRonda(estado)).toBe(true);
    expect(estado.resultado).toBe("victoria");
    expect(
      estado.comunidades.every(
        (comunidad) => comunidad.soporte >= CONFIG.UMBRAL_ACEPTABLE,
      ),
    ).toBe(true);
    expect(confirmarRonda(estado)).toBe(false);
  });

  it("reinicia la partida con la semilla indicada y rechaza una semilla inválida", () => {
    const estado = crearEstadoInicial(12);
    estado.ronda = 3;
    estado.inventario.agua = 4;
    estado.comunidades[0].soporte = 10;

    expect(reiniciarJuego(estado, 42)).toBe(true);
    expect(estado).toEqual(crearEstadoInicial(42));

    estado.ronda = 2;
    expect(reiniciarJuego(estado, 1.5)).toBe(false);
    expect(estado.ronda).toBe(2);
  });

  it("completa una partida y alcanza la victoria siguiendo repartos válidos", () => {
    const estado = crearEstadoInicial(7);
    const ids: ComunidadId[] = ["norte", "sur", "este", "oeste"];
    const recursos: Recurso[] = ["agua", "comida", "medicina"];
    const objetivosAcumulados = [1, 2, 4, 5, 7];
    const totalAsignado: Record<ComunidadId, number> = {
      norte: 0,
      sur: 0,
      este: 0,
      oeste: 0,
    };

    while (estado.resultado === "en-curso") {
      const objetivo = objetivosAcumulados[estado.ronda - 1];

      for (const id of ids) {
        let pendiente = Math.max(0, objetivo - totalAsignado[id]);

        for (const recurso of recursos) {
          const comunidad = estado.comunidades.find((elemento) => elemento.id === id)!;
          const unidadesYaAsignadas = estado.comunidades.reduce(
            (total, elemento) => total + elemento.asignacion[recurso],
            0,
          );
          const disponible = estado.inventario[recurso] - unidadesYaAsignadas;
          const cantidad = Math.min(
            pendiente,
            comunidad.necesidades[recurso],
            disponible,
          );

          if (cantidad > 0) {
            expect(asignar(estado, id, recurso, cantidad)).toBe(true);
            totalAsignado[id] += cantidad;
            pendiente -= cantidad;
          }
        }
      }

      expect(confirmarRonda(estado)).toBe(true);
    }

    expect(estado.ronda).toBe(CONFIG.RONDAS_TOTALES);
    expect(estado.resultado).toBe("victoria");
    expect(
      estado.comunidades.every(
        (comunidad) => comunidad.soporte >= CONFIG.UMBRAL_ACEPTABLE,
      ),
    ).toBe(true);
  });
});
