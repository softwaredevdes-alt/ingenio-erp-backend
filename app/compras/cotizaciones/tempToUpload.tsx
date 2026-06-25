  const guardarEdicion = async () => {
      if (!editingCotizacion || !selectedSolicitud) return;

      const cantidadNueva = Number(nuevaCotizacion.cantidad) || 0;

      if (cantidadNueva <= 0) {
          alert("La cantidad debe ser mayor a 0");
          return;
      }

      if (cantidadNueva > selectedSolicitud.cantidad) {
          alert(`La cantidad de la cotización (${cantidadNueva}) no puede superar la cantidad solicitada (${selectedSolicitud.cantidad}).`);
          return;
      }

      try {
          const { error } = await supabase.from('cotizaciones').update({
              proveedor: nuevaCotizacion.proveedor,
              precio_unitario: Number(nuevaCotizacion.precio_unitario),
                                                                       cantidad: cantidadNueva,
                                                                       tiempo_entrega_dias: nuevaCotizacion.tiempo_entrega_dias ? Number(nuevaCotizacion.tiempo_entrega_dias) : null,
                                                                       observaciones: nuevaCotizacion.observaciones || null,
                                                                       creado_por: nuevaCotizacion.creado_por || null,
          }).eq('id', editingCotizacion.id);

          if (error) throw error;

          // Actualizar la OC si la cotización estaba seleccionada
          if (editingCotizacion.estado === 'seleccionada') {
              const { data: oc } = await supabase
              .from('ordenes_compra')
              .select('id')
              .eq('cotizacion_id', editingCotizacion.id)
              .single();

              if (oc) {
                  await supabase.from('ordenes_compra').update({
                      proveedor: nuevaCotizacion.proveedor,
                      total: Number(nuevaCotizacion.precio_unitario) * cantidadNueva,
                                                               cantidad: cantidadNueva,
                  }).eq('id', oc.id);
              }
          }

          alert('Cotización y Orden de Compra actualizadas correctamente');
          setShowEditModal(false);
          setEditingCotizacion(null);
          setNuevaCotizacion({ proveedor: '', precio_unitario: '', cantidad: '', tiempo_entrega_dias: '', observaciones: '', creado_por: '' });
          if (selectedSolicitud) {
              const cotis = await cargarCotizaciones(selectedSolicitud.id);
              setCotizaciones(cotis);
          }
      }
      catch (error) {
          console.error(error);
          alert('Error al actualizar');
      }
  };

  const eliminarCotizacion = async (cot: Cotizacion) => {
      const isSelected = cot.estado === 'seleccionada';

      let mensaje = `¿Eliminar la cotización de "${cot.proveedor}"?`;
      if (isSelected) {
          mensaje = `⚠️ Esta cotización ya está SELECCIONADA y tiene una Orden de Compra asociada.\n\n¿Estás seguro de eliminarla? Esto eliminará la OC correspondiente.`;
      }

      if (!confirm(mensaje)) return;

      try {
          // Eliminar solo la OC asociada a esta cotización
          if (isSelected) {
              await supabase
              .from('ordenes_compra')
              .delete()
              .eq('cotizacion_id', cot.id);
          }

          // Eliminar la cotización
          await supabase.from('cotizaciones').delete().eq('id', cot.id);

          alert('Cotización eliminada correctamente');

          if (selectedSolicitud) {
              const cotis = await cargarCotizaciones(selectedSolicitud.id);
              setCotizaciones(cotis);
          }
          cargarSolicitudes();
      } catch (error) {
          console.error(error);
          alert('Error al eliminar la cotización');
      }
  };
