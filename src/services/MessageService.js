// src/services/MessageService.js
const supabase = require('../config/supabase');

class MessageService {
  async saveMessage(userId, role, content) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          user_id: userId.toString(),
          role: role,
          content: content,
          created_at: new Date().toISOString()
        }]);
      
      if (error) {
        console.error('❌ Error Supabase:', error.message);
        return false;
      }
      
      console.log(`✅ Mensaje guardado: ${userId} - ${role}`);
      return true;
    } catch (error) {
      console.error('❌ Error en saveMessage:', error.message);
      return false;
    }
  }

  async getUserHistory(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId.toString())
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data.reverse();
    } catch (error) {
      console.error('❌ Error obteniendo historial:', error.message);
      return [];
    }
  }
}

module.exports = new MessageService();