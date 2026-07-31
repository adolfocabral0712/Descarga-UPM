export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint utilizado por el dashboard.
    if (url.pathname === "/api/datos") {
      return obtenerDatosDropbox(env);
    }

    // Para cualquier otra ruta, servir los archivos de la carpeta public.
    return env.ASSETS.fetch(request);
  }
};

async function obtenerDatosDropbox(env) {
  // La URL de Dropbox se configura en Cloudflare como variable/secreto.
  if (!env.DROPBOX_JSON_URL) {
    return respuestaJSON(
      {
        error: "Falta configurar DROPBOX_JSON_URL"
      },
      500
    );
  }

  try {
    // Agregar un valor variable para evitar que Dropbox o el navegador
    // entreguen una versión anterior del JSON.
    const separador = env.DROPBOX_JSON_URL.includes("?") ? "&" : "?";
    const urlDropbox =
      `${env.DROPBOX_JSON_URL}${separador}t=${Date.now()}`;

    const respuesta = await fetch(urlDropbox, {
      method: "GET",
      headers: {
        "User-Agent": "Cloudflare-Worker-Descarga-UPM/1.0",
        "Accept": "application/json,text/plain,*/*"
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    });

    if (!respuesta.ok) {
      return respuestaJSON(
        {
          error: "No fue posible obtener los datos desde Dropbox",
          estadoDropbox: respuesta.status
        },
        502
      );
    }

    const texto = await respuesta.text();

    // Verificar que Dropbox realmente haya devuelto un JSON válido.
    try {
      JSON.parse(texto);
    } catch {
      return respuestaJSON(
        {
          error:
            "Dropbox respondió, pero el contenido no es un JSON válido"
        },
        502
      );
    }

    return new Response(texto, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return respuestaJSON(
      {
        error: "No fue posible obtener los datos desde Dropbox",
        detalle:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
    );
  }
}

function respuestaJSON(contenido, estado = 200) {
  return new Response(JSON.stringify(contenido), {
    status: estado,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
