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
    userStates[chatId] = {
      action: 'crear_ot',
      step: 'cliente_id',
      data: {}
    };
    
    await editMessage(
      chatId,
      messageId,
      '<b>➕ Nueva Orden de Trabajo</b>\n\n📝 <b>Paso 1 de 6:</b> Ingresa el <b>ID del cliente</b>\n\n💡 Usa el menú Clientes → Buscar para obtener el ID',
      [[btn('❌ Cancelar', 'ots:cancelar')]]
    );
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
  // FACTURAS
  // ==========================================
  
  async showFacturasMenu(chatId, messageId) {
    await editMessage(
      chatId,
      messageId,
      '<b>💰 Gestión de Facturas</b>\n\n🚧 <b>Próximamente...</b>\n\nEsta funcionalidad estará disponible pronto.',
      [[btn('🔙 Volver', 'menu:principal')]]
    );
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
    
    // ========== WIZARD: CREAR OT ==========
    if (state.action === 'crear_ot') {
      const steps = ['cliente_id', 'matricula', 'marca', 'modelo', 'descripcion', 'horas'];
      const stepIndex = steps.indexOf(state.step);
      
      if (stepIndex < steps.length - 1) {
        state.step = steps[stepIndex + 1];
        const stepNames = {
          matricula: 'la matrícula del vehículo',
          marca: 'la marca del vehículo',
          modelo: 'el modelo del vehículo',
          descripcion: 'la descripción del trabajo a realizar',
          horas: 'las horas estimadas (número)'
        };
        
        await sendKeyboard(
          chatId,
          `<b>➕ Nueva OT</b>\n\n📝 <b>Paso ${stepIndex + 2} de 6:</b> Ingresa ${stepNames[state.step]}`,
          [[btn('❌ Cancelar', 'ots:cancelar')]]
        );
      } else {
        // Guardar OT
        await sendMessage(chatId, '⏳ Creando orden de trabajo...');
        
        try {
          // Convertir horas a número
          state.data.horas = parseFloat(state.data.horas) || 1;
          
          const ot = await otService.createOT(state.data);
          delete userStates[chatId];
          
          const successText =
            '✅ <b>Orden de Trabajo creada exitosamente</b>\n\n' +
            `🔧 <b>OT-${ot.OT_ID.slice(0, 8)}</b>\n` +
            `🚗 Vehículo: ${ot.marca} ${ot.modelo}\n` +
            `🚘 Matrícula: ${ot.matricula}\n` +
            `⏱️ Horas: ${ot.horas}h\n` +
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

