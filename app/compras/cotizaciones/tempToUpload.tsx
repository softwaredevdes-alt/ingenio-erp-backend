  const guardarEdicion = async () => {
      if (!editingCotizacion || !selectedSolicitud) return;

      // Validación de cantidad total al editar
      const cantidadNueva = Number(nuevaCotizacion.cantidad) || 0;
      const cantidadAnterior = Number(editingCotizacion.cantidad) || 0;

      if (cantidadNueva <= 0) {
          alert("La cantidad debe ser mayor a 0");
          return;
      }

      if (!Number.isInteger(cantidadNueva)) {
          alert("La cantidad debe ser un número entero");
          return;
      }

      // Consulta fresca de cotizaciones
      const { data: cotizacionesExistentes } = await supabase
      .from('cotizaciones')
      .select('id, cantidad')
      .eq('solicitud_id', selectedSolicitud.id);

      const cantidadYaCotizadaSinEsta = cotizacionesExistentes
      ?.filter(c => String(c.id) !== String(editingCotizacion.id))
      ?.reduce((sum, c) => sum + Number(c.cantidad || 0), 0) || 0;

      const totalCotizado = cantidadYaCotizadaSinEsta + cantidadNueva;

      if (totalCotizado > selectedSolicitud.cantidad) {
          alert(`La cantidad total cotizada (${totalCotizado}) excede la cantidad solicitada (${selectedSolicitud.cantidad}).`);
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

          alert('Cotización actualizada correctamente');
          setShowEditModal(false);
          setEditingCotizacion(null);
          setNuevaCotizacion({ proveedor: '', precio_unitario: '', cantidad: '', tiempo_entrega_dias: '', observaciones: '', creado_por: '' });

          // Después del update de cotización, actualiza la OC si estaba seleccionada
          if (editingCotizacion.estado === 'seleccionada') {
              const { data: oc } = await supabase
              .from('ordenes_compra')
              .select('id')
              .eq('solicitud_id', selectedSolicitud.id)
              .single();

              if (oc) {
                  await supabase.from('ordenes_compra').update({
                      proveedor: nuevaCotizacion.proveedor,
                      total: Number(nuevaCotizacion.precio_unitario) * cantidadNueva,
                                                               cantidad: cantidadNueva,
                  }).eq('id', oc.id);
              }
          }

          if (selectedSolicitud) {
              const cotis = await cargarCotizaciones(selectedSolicitud.id);
              setCotizaciones(cotis);
          }
          cargarSolicitudes();
      } catch (error) {
          console.error(error);
          alert('Error al actualizar la cotización');
      }
  };
