import { supabase } from './supabase';

// =============================================
// Generador de Número de Orden de Compra
// Formato: yymmdd-XXXX (ej: 260627-3847)
// =============================================
export const generarNumeroOC = async (): Promise<string> => {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const fechaPrefijo = `${yy}${mm}${dd}`;

    let numeroOC = '';
    let existe = true;
    let intentos = 0;
    const maxIntentos = 15;

    while (existe && intentos < maxIntentos) {
        // Generar 4 dígitos aleatorios
        const randomPart = Math.floor(1000 + Math.random() * 9000); // 1000 - 9999
        numeroOC = `${fechaPrefijo}-${randomPart}`;

        // Verificar si ya existe en la base de datos
        const { data, error } = await supabase
        .from('ordenes_compra')
        .select('id')
        .eq('numero_oc', numeroOC)
        .maybeSingle();

        if (error) {
            console.error('Error verificando número de OC:', error);
        }

        existe = !!data;
        intentos++;

        if (existe) {
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }

    // Si después de varios intentos sigue habiendo colisión (muy raro)
    if (existe) {
        const randomPart = Math.floor(100000 + Math.random() * 900000); // 6 dígitos
        numeroOC = `${fechaPrefijo}-${randomPart}`;
    }

    return numeroOC;
};

// =============================================
// Aquí puedes ir agregando más utilidades después
// Ejemplos futuros:
// - formatearMoneda()
// - calcularDiasTranscurridos()
// - generarSlug()
// etc.
// =============================================
