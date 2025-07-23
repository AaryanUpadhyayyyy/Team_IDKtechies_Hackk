import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, List, ListItem, ListItemText, CircularProgress, Avatar } from '@mui/material';
import axios from 'axios';

const ChatBox = () => {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hi! Ask me anything about your insurance documents.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper to convert messages to LLM format
  const toLLMMessages = (msgs) => [
    { role: 'system', content: 'You are an expert assistant for insurance and document queries.' },
    ...msgs.filter(m => m.sender !== 'ai' || m.text !== 'Hi! Ask me anything about your insurance documents.').map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }))
  ];

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { sender: 'user', text: input }];
    setMessages(newMessages);
    setLoading(true);
    setInput('');
    try {
      const response = await axios.post('http://localhost:8000/chat', {
        messages: toLLMMessages(newMessages)
      });
      setMessages((msgs) => [...msgs, { sender: 'ai', text: response.data.response }]);
    } catch (err) {
      setMessages((msgs) => [...msgs, { sender: 'ai', text: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <Paper elevation={4} sx={{ mt: 5, p: 2, borderRadius: 3, background: '#fff', maxWidth: 500, mx: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 1 }} color="primary">AI Chat</Typography>
      <List sx={{ maxHeight: 250, overflowY: 'auto', mb: 1, bgcolor: '#f7fafd', borderRadius: 2, p: 1 }}>
        {messages.map((msg, idx) => (
          <ListItem key={idx} sx={{
            display: 'flex',
            flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            gap: 1,
            mb: 1
          }}>
            <Avatar sx={{ bgcolor: msg.sender === 'user' ? '#1976d2' : '#43a047', width: 32, height: 32, fontSize: 18 }}>
              {msg.sender === 'user' ? 'U' : 'AI'}
            </Avatar>
            <ListItemText
              primary={msg.text}
              sx={{
                bgcolor: msg.sender === 'user' ? '#1976d2' : '#e0e0e0',
                color: msg.sender === 'user' ? '#fff' : '#333',
                px: 2, py: 1, borderRadius: 2, maxWidth: '80%',
                textAlign: msg.sender === 'user' ? 'right' : 'left',
                boxShadow: 1
              }}
            />
          </ListItem>
        ))}
        {loading && (
          <ListItem sx={{ justifyContent: 'flex-start', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: '#43a047', width: 32, height: 32, fontSize: 18 }}>AI</Avatar>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">AI is typing...</Typography>
            </Box>
          </ListItem>
        )}
      </List>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question..."
          size="small"
          fullWidth
          disabled={loading}
        />
        <Button variant="contained" onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </Button>
      </Box>
    </Paper>
  );
};

export default ChatBox; 