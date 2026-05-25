import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const quoteId = url.searchParams.get('id');
    const tipo = url.searchParams.get('type') || 'cliente';

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'Falta id' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: quote, error: qErr } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: 'Cotización no encontrada' }), { status: 404, headers: corsHeaders });
    }

    const { data: items, error: iErr } = await supabase
      .from('quotation_items')
      .select('*, parts(codigo_producto, codigo, name, internal_measure, external_measure, height, marca)')
      .eq('quotation_id', quoteId);

    if (iErr || !items) {
      return new Response(JSON.stringify({ error: 'Error obteniendo ítems' }), { status: 500, headers: corsHeaders });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height: pageH } = page.getSize();
    const margin = 50;

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = pageH - margin;

    const drawText = (text: string, x: number, yPos: number, size = 10, bold = false, color = rgb(0, 0, 0)) => {
      page.drawText(String(text), { x, y: yPos, size, font: bold ? fontBold : fontReg, color });
    };

    const drawLine = (yPos: number, color = rgb(0.8, 0.8, 0.8)) => {
      page.drawLine({ start: { x: margin, y: yPos }, end: { x: width - margin, y: yPos }, thickness: 0.5, color });
    };

    const fmtDate = (d: string) => {
      const dt = new Date(d);
      return dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    drawText('La casa de los retenes S&G', width / 2 - 130, y, 18, true);
    y -= 22;
    const subtitleText = tipo === 'interno' ? 'COTIZACION — USO INTERNO' : 'COTIZACION';
    const subtitleColor = tipo === 'interno' ? rgb(0.49, 0.23, 0.93) : rgb(0.33, 0.33, 0.33);
    drawText(subtitleText, width / 2 - 70, y, 12, false, subtitleColor);
    y -= 20;

    const qDate = new Date(quote.quote_date);
    const validUntil = new Date(qDate);
    validUntil.setDate(validUntil.getDate() + (quote.valid_days || 7));

    drawText(`Fecha de emision: ${fmtDate(quote.quote_date)}`, width - margin - 180, y, 9);
    y -= 13;
    drawText(`Valida hasta: ${fmtDate(validUntil.toISOString())}`, width - margin - 180, y, 9);
    y -= 18;

    drawText('Cliente: ', margin, y, 11, true);
    drawText(quote.cliente, margin + 55, y, 11);
    y -= 15;

    if (quote.notes) {
      drawText('Notas: ', margin, y, 10, true);
      drawText(quote.notes, margin + 45, y, 10);
      y -= 15;
    }

    y -= 5;
    drawLine(y);
    y -= 12;

    if (tipo === 'interno') {
      drawText('#',            margin,       y, 9, true);
      drawText('Cod.Producto', margin + 22,  y, 9, true);
      drawText('Medidas',      margin + 135, y, 9, true);
      drawText('Referencia',   margin + 238, y, 9, true);
      drawText('Cant',         margin + 318, y, 9, true);
      drawText('P.Unit Bs.',   margin + 360, y, 9, true);
      drawText('Subtotal Bs.', margin + 426, y, 9, true);
    } else {
      drawText('#',                       margin,       y, 9, true);
      drawText('Medidas (MI x ME x ALT)', margin + 25,  y, 9, true);
      drawText('Cant',                    margin + 285, y, 9, true);
      drawText('P.Unit Bs.',              margin + 330, y, 9, true);
      drawText('Subtotal Bs.',            margin + 422, y, 9, true);
    }

    y -= 4;
    drawLine(y, rgb(0.2, 0.2, 0.2));
    y -= 13;

    items.forEach((item: any, i: number) => {
      const part = item.parts || {};
      const measures = `${part.internal_measure ?? 0}x${part.external_measure ?? 0}x${part.height ?? 0}`;
      const sub = ((item.quantity ?? 0) * (item.unit_price ?? 0)).toFixed(2);

      if (i % 2 === 0) {
        page.drawRectangle({ x: margin, y: y - 3, width: width - 2 * margin, height: 14, color: rgb(0.97, 0.97, 0.97) });
      }

      if (tipo === 'interno') {
        drawText(String(i + 1),              margin,       y, 9);
        drawText(part.codigo_producto ?? '-', margin + 22,  y, 9);
        drawText(measures,                   margin + 135, y, 9);
        drawText(part.codigo ?? '-',         margin + 238, y, 9);
        drawText(String(item.quantity),      margin + 318, y, 9);
        drawText(item.unit_price?.toFixed(2) ?? '0', margin + 360, y, 9);
        drawText(sub,                        margin + 426, y, 9);
      } else {
        const measuresLong = `${part.internal_measure ?? 0} x ${part.external_measure ?? 0} x ${part.height ?? 0}`;
        drawText(String(i + 1),              margin,       y, 9);
        drawText(measuresLong,               margin + 25,  y, 9);
        drawText(String(item.quantity),      margin + 285, y, 9);
        drawText(item.unit_price?.toFixed(2) ?? '0', margin + 330, y, 9);
        drawText(sub,                        margin + 422, y, 9);
      }

      y -= 16;
    });

    y -= 5;
    drawLine(y, rgb(0.2, 0.2, 0.2));
    y -= 18;
    drawText(`TOTAL: Bs. ${(quote.total ?? 0).toFixed(2)}`, width - margin - 130, y, 13, true);

    y -= 50;
    drawText(`Esta cotizacion es valida por ${quote.valid_days || 7} dias desde su emision.`, width / 2 - 130, y, 8, false, rgb(0.53, 0.53, 0.53));
    y -= 12;
    drawText('La casa de los retenes S&G', width / 2 - 80, y, 8, false, rgb(0.53, 0.53, 0.53));

    const pdfBytes = await pdfDoc.save();
    const suffix = tipo === 'interno' ? '-interno' : '-cliente';

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cotizacion-${quoteId}${suffix}.pdf"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
