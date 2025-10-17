// src/controllers/BotController.js
const { sendTyping, sendMessage, sendKeyboard, editMessage, btn } = require('../helpers/telegramHelpers');
const messageService = require('../services/MessageService');
const clientService = require('../services/ClientService');
const otService = require('../services/OTService');
const dashboardService = require('../services/DashboardService');

// Estado temporal de usuarios (para wizards)
const userStates = {};

class BotController {
  
  // ==========================================
  // MENÚ PRINCIPAL
  // ==========================================
  
  async showMainMenu(chatId, messageId = null) {
    const menu = [
      [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
      [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
      [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Ayuda', 'menu:ayuda')]
    ];
    
    const text = '<b>🏠 Menú Principal - R&S Automoción</b>\n\nSelecciona una opción:';
    
    if (messageId) {
      await editMessage(chatId, messageId, text, menu);
    } else {
      await sendKeyboard(chatId, text, menu);
    }
  }
  // ==========================================
  // COMANDOS DE TEXTO
  // ==========================================
  
  async handleTextCommand(chatId, text) {
    await sendTyping(chatId);
    await messageService.saveMessage(chatId, 'user', text);
    
    if (text === '/start') {
      await this.showMainMenu(chatId);
      await messageService.saveMessage(chatId, 'assistant', 'Menú principal mostrado');
      return;
    }
    
    if (text === '/help') {
      const helpText = 
        '<b>📖 Ayuda - R&S Automoción</b>\n\n' +
        '<b>Comandos disponibles:</b>\n' +
        '/start - Iniciar bot y ver menú\n' +
        '/help - Ver esta ayuda\n' +
        '/stats - Ver estadísticas\n' +
        '/menu - Mostrar menú principal\n\n' +
        '<b>💡 Usa los botones para navegar fácilmente</b>';
      
      await sendKeyboard(chatId, helpText, [[btn('🏠 Menú Principal', 'menu:principal')]]);
      await messageService.saveMessage(chatId, 'assistant', helpText);
      return;
    }
    
    if (text === '/stats') {
      await this.showDashboard(chatId);
      return;
    }
    
    if (text === '/menu') {
      await this.showMainMenu(chatId);
      return;
    }
    
    // Si el usuario está en un wizard
    if (userStates[chatId]) {
      await this.handleWizardInput(chatId, text);
      return;
    }
    
    // Mensaje por defecto
    await sendMessage(chatId, 'Usa /start para ver el menú principal 😊');
    await messageService.saveMessage(chatId, 'assistant', 'Usa /start para ver el menú principal');
  }
  // ==========================================
  // CALLBACKS (BOTONES)
  // ==========================================
  
  async handleCallback(chatId, messageId, action) {
    await sendTyping(chatId);
    await messageService.saveMessage(chatId, 'user', `[Botón: ${action}]`);
    
    // Menú principal
    if (action === 'menu:principal') {
      await this.showMainMenu(chatId, messageId);
      return;
    }
    
    // CLIENTES
    if (action === 'menu:clientes') {
      await this.showClientesMenu(chatId, messageId);
      return;
    }
    
    if (action === 'clientes:nuevo') {
      await this.startClientWizard(chatId, messageId);
      return;
    }
    
    if (action === 'clientes:lista') {
      await this.showClientesList(chatId, messageId);
      return;
    }
    
    if (action === 'clientes:buscar') {
      await this.startClientSearch(chatId, messageId);
      return;
    }
    
    if (action === 'clientes:cancelar') {
      delete userStates[chatId];
      await this.showMainMenu(chatId, messageId);
      return;
    }
    
    // OT
    if (action === 'menu:ots') {
      await this.showOTMenu(chatId, messageId);
      return;
    }
    
    if (action === 'ots:nueva') {
      await this.startOTWizard(chatId, messageId);
      return;
    }
    if (action.startsWith('ots:select_cliente:')) {
  const clienteId = action.replace('ots:select_cliente:', '');
  userStates[chatId] = {
    action: 'crear_ot',
    step: 'matricula',
    data: { cliente_id: clienteId }
  };
  
  await editMessage(
    chatId,
    messageId,
    '<b>➕ Nueva OT</b>\n\n🚗 <b>Paso 2:</b> Ingresa la <b>matrícula</b> del vehículo',
    [[btn('❌ Cancelar', 'ots:cancelar')]]
  );
  return;
}

if (action === 'ots:buscar_cliente') {
  await this.searchClienteForOT(chatId, messageId);
  return;
}


    if (action === 'ots:lista') {
      await this.showOTList(chatId, messageId);
      return;
    }
    
    if (action === 'ots:cancelar') {
      delete userStates[chatId];
      await this.showMainMenu(chatId, messageId);
      return;
    }
    
    // DASHBOARD
    if (action === 'menu:dashboard') {
      await this.showDashboard(chatId, messageId);
      return;
    }
    

    // FACTURAS
    if (action === 'menu:facturas') {
      await this.showFacturasMenu(chatId, messageId);
      return;
    }
    
    if (action === 'facturas:nueva') {
      await this.startFacturaWizard(chatId, messageId);
      return;
    }
    
    if (action.startsWith('facturas:generar:')) {
      const otId = action.replace('facturas:generar:', '');
      await this.generateFacturaFromOT(chatId, messageId, otId);
      return;
    }
    
    if (action === 'facturas:lista') {
      await this.showFacturasList(chatId, messageId);
      return;
    }
    
    if (action === 'facturas:pendientes') {
      await this.showFacturasPendientes(chatId, messageId);
      return;
    }
    
    // BÚSQUEDA
    if (action === 'menu:buscar') {
      await this.showBuscarMenu(chatId, messageId);
      return;
    }
    
    // AYUDA
    if (action === 'menu:ayuda') {
      const helpText = 
        '<b>📖 Ayuda</b>\n\n' +
        'Usa los botones del menú para:\n' +
        '• <b>Clientes:</b> Crear, buscar y listar\n' +
        '• <b>OT:</b> Crear órdenes de trabajo\n' +
        '• <b>Facturas:</b> Generar y gestionar\n' +
        '• <b>Dashboard:</b> Ver estadísticas\n' +
        '• <b>Buscar:</b> Búsqueda rápida\n\n' +
        'También puedes usar comandos como /start, /help, /stats';
      await editMessage(chatId, messageId, helpText, [[btn('🔙 Volver', 'menu:principal')]]);
      return;
    }
  }

  // ==========================================
  // GESTIÓN DE CLIENTES
  // ==========================================
  
  async showClientesMenu(chatId, messageId) {
    const menu = [
      [btn('➕ Nuevo Cliente', 'clientes:nuevo')],
      [btn('📋 Lista de Clientes', 'clientes:lista')],
      [btn('🔍 Buscar Cliente', 'clientes:buscar')],
      [btn('🔙 Volver', 'menu:principal')]
    ];
    
    await editMessage(chatId, messageId, '<b>👤 Gestión de Clientes</b>\n\nSelecciona una opción:', menu);
  }

  async startClientWizard(chatId, messageId) {
    userStates[chatId] = {
      action: 'crear_cliente',
      step: 'nombre',
      data: {}
    };
    
    await editMessage(
      chatId, 
      messageId, 
      '<b>➕ Nuevo Cliente</b>\n\n📝 <b>Paso 1 de 5:</b> Ingresa el <b>nombre</b> del cliente',
      [[btn('❌ Cancelar', 'clientes:cancelar')]]
    );
  }

  async showClientesList(chatId, messageId) {
    try {
      const { clientes } = await clientService.listClients(0, 10);
      
      let text = '<b>📋 Lista de Clientes</b>\n\n';
      
      if (clientes.length === 0) {
        text += 'No hay clientes registrados.';
      } else {
        clientes.forEach((c, i) => {
          text += `${i + 1}. <b>${c.nombre} ${c.apellidos}</b>\n`;
          text += `   🆔 NIF: ${c.nif}\n`;
          text += `   📞 Tel: ${c.telefono || 'N/A'}\n`;
          text += `   📧 ${c.email}\n\n`;
        });
      }
      
      await editMessage(chatId, messageId, text, [[btn('🔙 Volver', 'menu:clientes')]]);
    } catch (error) {
      await sendMessage(chatId, '❌ Error obteniendo clientes: ' + error.message);
    }
  }

  async startClientSearch(chatId, messageId) {
    userStates[chatId] = {
      action: 'buscar_cliente',
      step: 'query'
    };
    
    await editMessage(
      chatId,
      messageId,
      '<b>🔍 Buscar Cliente</b>\n\nIngresa <b>nombre</b>, <b>apellidos</b> o <b>NIF</b>:',
      [[btn('❌ Cancelar', 'clientes:cancelar')]]
    );
  }
// ==========================================
  // GESTIÓN DE OT
  // ==========================================
  
  async showOTMenu(chatId, messageId) {
    const menu = [
      [btn('➕ Nueva OT', 'ots:nueva')],
      [btn('📋 Lista de OT', 'ots:lista')],
      [btn('🔍 Buscar OT', 'ots:buscar')],
      [btn('🔙 Volver', 'menu:principal')]
    ];
    
    await editMessage(chatId, messageId, '<b>🔧 Gestión de Órdenes de Trabajo</b>\n\nSelecciona una opción:', menu);
  }

async startOTWizard(chatId, messageId) {
  try {
    // Obtener lista de clientes
    const { clientes } = await clientService.listClients(0, 10);
    
    if (!clientes || clientes.length === 0) {
      await editMessage(
        chatId,
        messageId,
        '<b>⚠️ No hay clientes registrados</b>\n\nPara crear una OT, primero debes registrar al menos un cliente.',
        [
          [btn('➕ Crear Cliente', 'clientes:nuevo')],
          [btn('🔙 Volver', 'menu:ots')]
        ]
      );
      return;
    }

    // Crear botones con los clientes
    const clienteButtons = clientes.slice(0, 8).map(c => [
      btn(
        `👤 ${c.nombre} ${c.apellidos} - ${c.nif}`,
        `ots:select_cliente:${c.cliente_id}`
      )
    ]);
    
    clienteButtons.push([btn('🔍 Buscar más...', 'ots:buscar_cliente')]);
    clienteButtons.push([btn('❌ Cancelar', 'ots:cancelar')]);

    await editMessage(
      chatId,
      messageId,
      '<b>➕ Nueva Orden de Trabajo</b>\n\n👤 <b>Paso 1:</b> Selecciona el cliente:',
      clienteButtons
    );
  } catch (error) {
    console.error('Error en startOTWizard:', error);
    await sendMessage(chatId, '❌ Error: ' + error.message);
  }
}

  async showOTList(chatId, messageId) {
    try {
      const ots = await otService.listOTs(0, 10);
      
      let text = '<b>📋 Lista de Órdenes de Trabajo</b>\n\n';
      
      if (!ots || ots.length === 0) {
        text += 'No hay OT registradas.';
      } else {
        ots.forEach((ot, i) => {
          text += `${i + 1}. <b>OT-${ot.OT_ID.slice(0, 8)}</b>\n`;
          text += `   🚗 Matrícula: ${ot.matricula || 'N/A'}\n`;
          text += `   🏷️ ${ot.marca || 'N/A'} ${ot.modelo || 'N/A'}\n`;
          text += `   📊 Estado: ${ot.estado}\n`;
          text += `   📅 ${new Date(ot.fecha_creacion).toLocaleDateString('es-ES')}\n\n`;
        });
      }
      
      await editMessage(chatId, messageId, text, [[btn('🔙 Volver', 'menu:ots')]]);
    } catch (error) {
      await sendMessage(chatId, '❌ Error obteniendo OT: ' + error.message);
    }
  }

  async searchClienteForOT(chatId, messageId) {
  userStates[chatId] = {
    action: 'buscar_cliente_ot',
    step: 'query'
  };
  
  await editMessage(
    chatId,
    messageId,
    '<b>🔍 Buscar Cliente para OT</b>\n\nIngresa <b>nombre</b> o <b>NIF</b> del cliente:',
    [[btn('❌ Cancelar', 'ots:cancelar')]]
  );
}


  // ==========================================
  // DASHBOARD
  // ==========================================
  
  async showDashboard(chatId, messageId = null) {
    try {
      const resumen = await dashboardService.getResumen();
      
      const text = 
        '<b>📊 Dashboard - R&S Automoción</b>\n\n' +
        `✅ <b>OT Completadas:</b> ${resumen.otCompletadas}\n` +
        `⏳ <b>OT Pendientes:</b> ${resumen.otPendientes}\n` +
        `💰 <b>Ingresos Brutos:</b> ${resumen.ingresosBrutos.toFixed(2)}€\n` +
        `💵 <b>Ingresos Netos:</b> ${resumen.ingresosNetos.toFixed(2)}€\n` +
        `⚠️ <b>Pagos Pendientes:</b> ${resumen.pagosPendientes.toFixed(2)}€\n` +
        `🔴 <b>Facturas Vencidas:</b> ${resumen.facturasVencidas}`;
      
      if (messageId) {
        await editMessage(chatId, messageId, text, [[btn('🔙 Volver', 'menu:principal')]]);
      } else {
        await sendKeyboard(chatId, text, [[btn('🏠 Menú Principal', 'menu:principal')]]);
      }
    } catch (error) {
      await sendMessage(chatId, '❌ Error obteniendo estadísticas: ' + error.message);
    }
  }


  // ==========================================
  // GESTIÓN DE FACTURAS
  // ==========================================
  
  async showFacturasMenu(chatId, messageId) {
    const menu = [
      [btn('➕ Nueva Factura', 'facturas:nueva')],
      [btn('📋 Lista de Facturas', 'facturas:lista')],
      [btn('💳 Facturas Pendientes', 'facturas:pendientes')],
      [btn('🔙 Volver', 'menu:principal')]
    ];
    
    await editMessage(chatId, messageId, '<b>💰 Gestión de Facturas</b>\n\nSelecciona una opción:', menu);
  }

  async startFacturaWizard(chatId, messageId) {
    try {
      // Obtener OT finalizadas
      const ots = await otService.listByState('finalizado', 10);
      
      if (!ots || ots.length === 0) {
        await editMessage(
          chatId,
          messageId,
          '<b>⚠️ No hay OT finalizadas</b>\n\nPara generar una factura, primero debes tener órdenes de trabajo con estado "finalizado".',
          [[btn('🔙 Volver', 'menu:facturas')]]
        );
        return;
      }

      // Crear botones con las OT
      const otButtons = ots.map(ot => [
        btn(
          `🔧 OT-${ot.ot_id.slice(0, 8)} - ${ot.matricula}`,
          `facturas:generar:${ot.ot_id}`
        )
      ]);
      
      otButtons.push([btn('🔙 Cancelar', 'menu:facturas')]);

      await editMessage(
        chatId,
        messageId,
        '<b>➕ Nueva Factura</b>\n\nSelecciona la OT a facturar:',
        otButtons
      );
    } catch (error) {
      console.error('Error en startFacturaWizard:', error);
      await sendMessage(chatId, '❌ Error obteniendo OT: ' + error.message);
    }
  }

  async generateFacturaFromOT(chatId, messageId, otId) {
    try {
      await editMessage(chatId, messageId, '⏳ <b>Generando factura...</b>\nEsto puede tardar unos segundos.', []);
      
      // Importar servicios necesarios
      const facturaService = require('../services/FacturaService');
      const { generateFacturaPDF } = require('../utils/pdfGenerator');
      const { uploadPDF } = require('../helpers/supabaseStorage');
      const { sendTyping } = require('../helpers/telegramHelpers');
      const { BOT_TOKEN } = require('../config/telegram');

      // Crear factura
      const factura = await facturaService.createFromOT(otId);

      // Generar PDF
      await sendTyping(chatId);
      const pdfBuffer = await generateFacturaPDF(factura);

      // Subir a Supabase
      const fileName = `Factura_${factura.numero.replace('/', '_')}.pdf`;
      const pdfUrl = await uploadPDF(pdfBuffer, fileName);

      // Actualizar factura con el link del PDF
      factura.pdf_link = pdfUrl;
      await factura.save();

      // Enviar PDF por Telegram
      await sendTyping(chatId);
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName);
      formData.append('caption', 
        `✅ <b>Factura ${factura.numero} generada</b>\n\n` +
        `💰 Total: ${factura.total_factura.toFixed(2)}€\n` +
        `📅 Vencimiento: ${new Date(factura.fecha_vencimiento).toLocaleDateString('es-ES')}\n` +
        `🔗 <a href="${pdfUrl}">Ver en línea</a>`,
        { parse_mode: 'HTML' }
      );

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      // Mostrar resumen con botones
      await sendKeyboard(
        chatId,
        `✅ <b>Factura ${factura.numero}</b>\n\n` +
        `🔧 OT: ${otId.slice(0, 8)}\n` +
        `💰 Total: <b>${factura.total_factura.toFixed(2)}€</b>\n` +
        `📊 Estado: ${factura.estado_pago}\n` +
        `📅 Vencimiento: ${new Date(factura.fecha_vencimiento).toLocaleDateString('es-ES')}`,
        [
          [btn('📋 Ver Facturas', 'facturas:lista')],
          [btn('🏠 Menú Principal', 'menu:principal')]
        ]
      );

      await messageService.saveMessage(chatId, 'assistant', `Factura ${factura.numero} generada`);

    } catch (error) {
      console.error('Error generando factura:', error);
      await sendMessage(
        chatId,
        `❌ <b>Error generando factura</b>\n\n${error.message}\n\nIntenta de nuevo más tarde.`
      );
    }
  }

  async showFacturasList(chatId, messageId) {
    try {
      const { facturas } = await require('../services/FacturaService').listFacturas(0, 10);
      
      let text = '<b>📋 Lista de Facturas</b>\n\n';
      
      if (!facturas || facturas.length === 0) {
        text += 'No hay facturas registradas.';
      } else {
        facturas.forEach((f, i) => {
          const emoji = f.estado_pago === 'pagado' ? '✅' : f.estado_pago === 'vencido' ? '🔴' : '⏳';
          text += `${i + 1}. ${emoji} <b>${f.numero}</b>\n`;
          text += `   💰 Total: ${f.total_factura.toFixed(2)}€\n`;
          text += `   📊 ${f.estado_pago}\n`;
          if (f.monto_pendiente > 0) {
            text += `   ⚠️ Pendiente: ${f.monto_pendiente.toFixed(2)}€\n`;
          }
          text += `   👤 ${f.cliente.nombre}\n\n`;
        });
      }
      
      await editMessage(chatId, messageId, text, [[btn('🔙 Volver', 'menu:facturas')]]);
    } catch (error) {
      await sendMessage(chatId, '❌ Error obteniendo facturas: ' + error.message);
    }
  }

  async showFacturasPendientes(chatId, messageId) {
    try {
      const facturaService = require('../services/FacturaService');
      const pendientes = await facturaService.listByState('pendiente', 20);
      const parciales = await facturaService.listByState('parcial', 20);
      const todas = [...pendientes, ...parciales];
      
      let text = '<b>💳 Facturas Pendientes de Pago</b>\n\n';
      
      if (todas.length === 0) {
        text += '✅ No hay facturas pendientes.';
      } else {
        let totalPendiente = 0;
        todas.forEach((f, i) => {
          const emoji = f.estado_pago === 'parcial' ? '⏳' : '❗';
          text += `${i + 1}. ${emoji} <b>${f.numero}</b>\n`;
          text += `   💰 Pendiente: ${f.monto_pendiente.toFixed(2)}€\n`;
          text += `   📅 Venc: ${new Date(f.fecha_vencimiento).toLocaleDateString('es-ES')}\n\n`;
          totalPendiente += f.monto_pendiente;
        });
        
        text += `\n<b>💰 Total pendiente: ${totalPendiente.toFixed(2)}€</b>`;
      }
      
      await editMessage(chatId, messageId, text, [[btn('🔙 Volver', 'menu:facturas')]]);
    } catch (error) {
      await sendMessage(chatId, '❌ Error: ' + error.message);
    }
  }


  // ==========================================
  // BÚSQUEDA
  // ==========================================
  
  async showBuscarMenu(chatId, messageId) {
    const menu = [
      [btn('👤 Buscar Cliente', 'buscar:cliente')],
      [btn('🔧 Buscar OT', 'buscar:ot')],
      [btn('🔙 Volver', 'menu:principal')]
    ];
    
    await editMessage(chatId, messageId, '<b>🔍 Búsqueda Rápida</b>\n\n¿Qué deseas buscar?', menu);
  }

  // ==========================================
  // MANEJO DE WIZARDS (FORMULARIOS PASO A PASO)
  // ==========================================
  
  async handleWizardInput(chatId, text) {
    const state = userStates[chatId];
    if (!state) return;
    
    // Guardar input del usuario
    state.data[state.step] = text.trim();
    await messageService.saveMessage(chatId, 'user', text);
    
    // ========== WIZARD: CREAR CLIENTE ==========
    if (state.action === 'crear_cliente') {
      const steps = ['nombre', 'apellidos', 'nif', 'email', 'direccion'];
      const stepIndex = steps.indexOf(state.step);
      
      if (stepIndex < steps.length - 1) {
        // Siguiente paso
        state.step = steps[stepIndex + 1];
        const stepNames = {
          apellidos: 'apellidos',
          nif: 'NIF/CIF',
          email: 'email',
          direccion: 'dirección completa'
        };
        
        await sendKeyboard(
          chatId,
          `<b>➕ Nuevo Cliente</b>\n\n📝 <b>Paso ${stepIndex + 2} de 5:</b> Ingresa ${stepNames[state.step]}`,
          [[btn('❌ Cancelar', 'clientes:cancelar')]]
        );
      } else {
        // Último paso - guardar cliente
        await sendMessage(chatId, '⏳ Guardando cliente...');
        
        try {
          const cliente = await clientService.createClient(state.data);
          delete userStates[chatId];
          
          const successText =
            '✅ <b>Cliente guardado exitosamente</b>\n\n' +
            `👤 <b>${cliente.nombre} ${cliente.apellidos}</b>\n` +
            `🆔 ID: <code>${cliente.cliente_id.slice(0, 12)}...</code>\n` +
            `📧 Email: ${cliente.email}\n` +
            `🆔 NIF: ${cliente.nif}`;
          
          await sendKeyboard(chatId, successText, [
            [btn('👤 Ver Clientes', 'clientes:lista')],
            [btn('🏠 Menú Principal', 'menu:principal')]
          ]);
          await messageService.saveMessage(chatId, 'assistant', successText);
        } catch (error) {
          await sendMessage(chatId, `❌ Error: ${error.message}\n\nIntenta de nuevo con /start`);
          delete userStates[chatId];
        }
      }
      return;
    }
    
    // ========== WIZARD: BUSCAR CLIENTE ==========
    if (state.action === 'buscar_cliente') {
      try {
        const clientes = await clientService.searchClients(text, 5);
        
        let resultText = '<b>🔍 Resultados de Búsqueda</b>\n\n';
        
        if (clientes.length === 0) {
          resultText += '❌ No se encontraron clientes con ese criterio.';
        } else {
          clientes.forEach((c, i) => {
            resultText += `${i + 1}. <b>${c.nombre} ${c.apellidos}</b>\n`;
            resultText += `   🆔 ID: <code>${c.cliente_id}</code>\n`;
            resultText += `   🆔 NIF: ${c.nif}\n`;
            resultText += `   📞 Tel: ${c.telefono || 'N/A'}\n\n`;
          });
        }
        
        delete userStates[chatId];
        await sendKeyboard(chatId, resultText, [[btn('🔙 Menú Clientes', 'menu:clientes')]]);
      } catch (error) {
        await sendMessage(chatId, '❌ Error en búsqueda: ' + error.message);
        delete userStates[chatId];
      }
      return;
    }
// ========== WIZARD: BUSCAR CLIENTE PARA OT ==========
if (state.action === 'buscar_cliente_ot') {
  try {
    const clientes = await clientService.searchClients(text, 10);
    
    if (clientes.length === 0) {
      await sendMessage(chatId, '❌ No se encontraron clientes.');
      delete userStates[chatId];
      return;
    }

    // Crear botones con resultados
    const clienteButtons = clientes.map(c => [
      btn(
        `👤 ${c.nombre} ${c.apellidos} - ${c.nif}`,
        `ots:select_cliente:${c.cliente_id}`
      )
    ]);
    
    clienteButtons.push([btn('🔙 Menú OT', 'menu:ots')]);

    await sendKeyboard(
      chatId,
      '<b>🔍 Resultados</b>\n\nSelecciona el cliente:',
      clienteButtons
    );
    
    delete userStates[chatId];
  } catch (error) {
    await sendMessage(chatId, '❌ Error en búsqueda: ' + error.message);
    delete userStates[chatId];
  }
  return;
}

    
    // ========== WIZARD: CREAR OT ==========
    if (state.action === 'crear_ot') {
      //const steps = ['cliente_id', 'matricula', 'marca', 'modelo', 'descripcion', 'horas'];
      const steps = ['matricula', 'marca', 'modelo', 'descripcion'];
      const stepIndex = steps.indexOf(state.step);
      
  if (stepIndex < steps.length - 1) {
    state.step = steps[stepIndex + 1];
    const stepNames = {
      marca: 'la <b>marca</b> del vehículo',
      modelo: 'el <b>modelo</b> del vehículo',
      descripcion: 'la <b>descripción</b> del trabajo a realizar'
    };
        
    await sendKeyboard(
      chatId,
      `<b>➕ Nueva OT</b>\n\n📝 <b>Paso ${stepIndex + 2} de 4:</b> Ingresa ${stepNames[state.step]}`,
      [[btn('❌ Cancelar', 'ots:cancelar')]]
    );
  } else {
 await sendMessage(chatId, '⏳ Creando orden de trabajo...');
    
    try {
      const ot = await otService.createOT(state.data, chatId.toString());
      delete userStates[chatId];
      
      const successText =
        '✅ <b>Orden de Trabajo creada</b>\n\n' +
        `🔧 <b>OT-${ot.ot_id.slice(0, 8)}</b>\n` +
        `🚗 Vehículo: ${ot.marca} ${ot.modelo}\n` +
        `🚘 Matrícula: ${ot.matricula}\n` +
        `📊 Estado: ${ot.estado}`;
      
      await sendKeyboard(chatId, successText, [
        [btn('🔧 Ver OT', 'ots:lista')],
        [btn('🏠 Menú Principal', 'menu:principal')]
      ]);
      await messageService.saveMessage(chatId, 'assistant', successText);
    } catch (error) {
      await sendMessage(chatId, `❌ Error: ${error.message}\n\nIntenta de nuevo con /start`);
      delete userStates[chatId];
    }
  }
  return;
}
  }
}

module.exports = new BotController();

