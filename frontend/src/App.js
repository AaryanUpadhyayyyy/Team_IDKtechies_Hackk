import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { AppBar, Toolbar, Typography, Container, TextField, Button, Box, CircularProgress, Alert, Paper, List, ListItem, ListItemText, Divider, Tabs, Tab, IconButton, Stack, Chip, Grid, ListItemIcon, ListItemButton, Modal, Fab } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DownloadIcon from '@mui/icons-material/Download';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import HomeIcon from '@mui/icons-material/Home';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import InfoIcon from '@mui/icons-material/Info';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import StarIcon from '@mui/icons-material/Star';
import ChatIcon from '@mui/icons-material/Chat';
import ChatBox from './ChatBox';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { highlightPlugin } from '@react-pdf-viewer/highlight';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

function App() {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [summarizerOpen, setSummarizerOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [summaryAnchor, setSummaryAnchor] = useState(null);
  const [pdfUrls, setPdfUrls] = useState([]); // [{name, url, file}]
  const [clausesByPdf, setClausesByPdf] = useState({}); // {pdfName: [clauses]}
  const [selectedPdfIdx, setSelectedPdfIdx] = useState(0);
  const [activeClauseIdx, setActiveClauseIdx] = useState(null);
  const viewerRef = useRef();
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [highlightedClause, setHighlightedClause] = useState(null);
  const highlightPluginInstance = highlightPlugin();

  // Keyboard shortcut for Clause Summarizer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        triggerSummarizer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Right-click context menu for Clause Summarizer
  const handleClauseContextMenu = (e, clauseText) => {
    e.preventDefault();
    setSelectedText(clauseText);
    setSummaryAnchor({ mouseX: e.clientX, mouseY: e.clientY });
    triggerSummarizer(clauseText);
  };

  // Main trigger for summarizer (uses selected text if not provided)
  const triggerSummarizer = (text) => {
    let clause = text;
    if (!clause) {
      const sel = window.getSelection();
      clause = sel && sel.toString();
    }
    if (!clause || clause.trim().length < 5) {
      setSummaryError('Please select a clause or some legal text to summarize.');
      setSummarizerOpen(true);
      return;
    }
    setSelectedText(clause);
    setSummary('');
    setSummaryError('');
    setSummaryLoading(true);
    setSummarizerOpen(true);
    // Call backend summarizer endpoint
    fetch('http://localhost:8000/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clause })
    })
      .then(res => res.json())
      .then(data => {
        setSummary(data.summary || 'No summary available.');
        if (data.confidence !== undefined) {
          setSummary(s => s + `\n\nConfidence: ${Math.round(data.confidence * 100)}%`);
        }
        if (data.flag) {
          setSummary(s => s + '\n\n⚠️ Model is unsure about this summary.');
        }
      })
      .catch(() => setSummaryError('Failed to summarize.'))
      .finally(() => setSummaryLoading(false));
  };

  // When a PDF is selected, set the URL and scan for clauses
  useEffect(() => {
    if (files && files.length > 0) {
      const urls = files.map(file => ({ name: file.name, url: URL.createObjectURL(file), file }));
      setPdfUrls(urls);
      urls.forEach(({ name, file }) => scanPdfForClauses(file, name));
      setSelectedPdfIdx(0);
    }
  }, [files]);

  // Scan PDF for clause/section headings (e.g., 1.1, 2.2, etc.)
  const scanPdfForClauses = async (file, pdfName) => {
    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const foundClauses = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      textContent.items.forEach(item => {
        const str = item.str.trim();
        if (/^\d+(\.\d+)+/.test(str)) {
          foundClauses.push({
            label: str,
            page: pageNum,
            y: item.transform[5],
            text: str
          });
        }
      });
    }
    setClausesByPdf(prev => ({ ...prev, [pdfName]: foundClauses }));
  };

  // Scroll to clause in PDF viewer and highlight
  const handleClauseClick = (clause, idx) => {
    setActiveClauseIdx(idx);
    setHighlightedClause(clause.label);
    if (viewerRef.current) {
      viewerRef.current.scrollToPage(clause.page - 1);
    }
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('query', query);
      files.forEach((file) => formData.append('file', file));
      const response = await axios.post('http://localhost:8000/query', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = response.data;
      setResult({
        decision: data.decision,
        payout_amount: data.amount ?? '',
        reasoning: data.justification ?? '',
        clause_mapping: Array.isArray(data.clause_mapping) ? data.clause_mapping : [],
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Fake updates/offers data
  const updates = [
    { title: 'Get 10% off on new Health Insurance plans!', color: 'success' },
    { title: 'Zero processing fee on EMI Card applications.', color: 'info' },
    { title: 'Refer a friend and earn rewards.', color: 'warning' },
    { title: 'Exclusive: Free annual health checkup with select policies.', color: 'primary' },
  ];

  // Fake sidebar features
  const sidebarLinks = [
    { icon: <HomeIcon />, label: 'Dashboard' },
    { icon: <LocalOfferIcon />, label: 'Offers & Deals' },
    { icon: <CreditCardIcon />, label: 'EMI Card Services' },
    { icon: <ShoppingCartIcon />, label: 'My Cart' },
    { icon: <AccountCircleIcon />, label: 'My Account' },
    { icon: <InfoIcon />, label: 'Policy Info' },
    { icon: <SupportAgentIcon />, label: 'Customer Support' },
    { icon: <StarIcon />, label: 'Premium Services' },
  ];

  // PDF/Clause selection logic
  const currentPdf = pdfUrls[selectedPdfIdx] || null;
  const currentClauses = currentPdf ? clausesByPdf[currentPdf.name] || [] : [];

  return (
    <Box sx={{ minHeight: '100vh', width: '100vw', background: '#f4f8fb' }}>
      {/* Top Navbar */}
      <AppBar position="static" sx={{ bgcolor: '#113984', boxShadow: 2 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 1 }}>
            Bajaj Insurance by IDKtechies
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
            <Button variant="contained" color="warning" size="small" sx={{ fontWeight: 600, bgcolor: '#ff6c00', '&:hover': { bgcolor: '#ff8c1a' } }} startIcon={<DownloadIcon />}>Download App</Button>
            <Button variant="outlined" color="inherit" size="small" sx={{ color: '#fff', borderColor: '#fff' }} startIcon={<CreditCardIcon />}>EMI Card</Button>
            <IconButton color="inherit"><NotificationsIcon /></IconButton>
            <IconButton color="inherit"><ShoppingCartIcon /></IconButton>
            <IconButton color="inherit"><AccountCircleIcon /></IconButton>
          </Stack>
          <TextField
            size="small"
            placeholder="Search Bajajfinserv.in"
            sx={{ bgcolor: '#fff', borderRadius: 1, minWidth: 250 }}
          />
        </Toolbar>
      </AppBar>
      {/* Colored Header */}
      <Box sx={{ bgcolor: '#00b39f', py: 3, px: 2, mt: 0, mb: 2 }}>
        <Container maxWidth="md">
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
           Insurance Queries
          </Typography>
          <Typography variant="body1" sx={{ color: '#e0f7fa', mt: 1 }}>
            Instantly analyze insurance policies, contracts, and claims using advanced Large Language Models (LLMs). Upload documents or enter queries to get automated decisions, clause mapping, and transparent reasoning—streamlining approvals, compliance, and customer support.
          </Typography>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100vw', minHeight: '80vh', gap: 0, mb: 4, px: 0, bgcolor: '#f4f8fb', overflow: 'hidden' }}>
        {/* Only show PDF viewer and clause navigator when open */}
        {showPdfViewer && currentPdf && (
          <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', justifyContent: 'center' }}>
            {currentClauses.length > 0 && (
              <Paper elevation={3} sx={{ width: 180, minWidth: 140, p: 2, borderRadius: '0 16px 16px 0', background: '#fff', position: 'relative', boxShadow: '2px 0 8px 0 rgba(0,0,0,0.04)', height: 'calc(100vh - 120px)', minHeight: '70vh', zIndex: 1200, overflowY: 'auto', mr: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#113984', mb: 2 }}>Clause Navigator</Typography>
                <List>
                  {currentClauses.map((cl, idx) => (
                    <ListItem key={idx} disablePadding selected={activeClauseIdx === idx} onClick={() => handleClauseClick(cl, idx)} sx={{ cursor: 'pointer', bgcolor: activeClauseIdx === idx ? '#e3f2fd' : undefined }}>
                      <ListItemButton>
                        <ListItemText primary={cl.label} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
            <Box sx={{ flex: 1, minWidth: 600, minHeight: '70vh', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', bgcolor: '#f4f8fb' }}>
              <Paper elevation={6} sx={{ p: 2, borderRadius: 4, boxShadow: 6, mb: 4, width: '100%', maxWidth: 900 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h5" fontWeight={700} color="primary.main" gutterBottom>PDF Viewer</Typography>
                  <Button variant="outlined" color="secondary" onClick={() => setShowPdfViewer(false)}>Close</Button>
                </Box>
                <Worker workerUrl="/pdf.worker.min.js">
                  <Viewer
                    fileUrl={currentPdf.url}
                    plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
                    ref={viewerRef}
                    renderHighlights={({ pageIndex, getText }) =>
                      highlightedClause ? highlightPluginInstance.Highlight({
                        pageIndex,
                        getText,
                        keyword: highlightedClause,
                        highlightStyle: {
                          backgroundColor: 'yellow',
                          color: 'black',
                        },
                      }) : null
                    }
                  />
                </Worker>
              </Paper>
            </Box>
          </Box>
        )}
        {/* Main Content */}
        <Box sx={{ flex: 1, ml: { md: '260px' }, minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: result ? 'flex-start' : 'center' }}>
          {/* Tabs (for looks) */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              textColor="primary"
              indicatorColor="primary"
              sx={{
                minHeight: 48,
                '.MuiTabs-flexContainer': {
                  justifyContent: 'center',
                  gap: 6,
                },
                '.MuiTab-root': {
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  minWidth: 100,
                  minHeight: 48,
                  transition: 'color 0.2s',
                  '&:hover': { color: '#ff6c00' },
                },
                '.Mui-selected': {
                  color: '#1565c0',
                },
                bgcolor: '#f4f8fb',
                borderBottom: '1.5px solid #e0e0e0',
              }}
              TabIndicatorProps={{ style: { height: 3, background: '#1565c0', borderRadius: 2, marginBottom: -2 } }}
            >
              <Tab label="All" />
              <Tab label="Health" />
              <Tab label="Car" />
              <Tab label="Bike" />
              <Tab label="Life" />
            </Tabs>
          </Box>
          {/* Hero Section if no query submitted */}
          {!result && (
            <Box sx={{ textAlign: 'center', mt: 6, mb: 6 }}>
              <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="AI Assistant" width={120} style={{ marginBottom: 24 }} />
              <Typography variant="h3" fontWeight={700} color="primary.main" gutterBottom>
                Team IDKtechies
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 4 }}>
              Upload your insurance policy and simply ask your question. Our LLM-powered system instantly analyzes documents to deliver accurate claim decisions, explain coverage details, and extract critical insights — all in natural language. <br />
              <b>Smarter insurance starts here.</b>
              </Typography>
            </Box>
          )}
          {/* Main Card */}
          <Paper elevation={6} sx={{ p: 5, borderRadius: 4, boxShadow: 6, mb: 4, transition: 'box-shadow 0.2s, transform 0.2s', '&:hover': { boxShadow: 12, transform: 'translateY(-2px) scale(1.01)' } }}>
            <Typography variant="h4" gutterBottom fontWeight={700} align="center" color="primary.main">
              Intelligent Document Query
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Enter your query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                fullWidth
                variant="outlined"
                sx={{ background: '#fff', borderRadius: 1 }}
              />
              <Button variant="contained" component="label" sx={{ fontWeight: 600, bgcolor: '#ff6c00', '&:hover': { bgcolor: '#ff8c1a' } }}>
                Upload PDF(s)
                <input type="file" accept="application/pdf" hidden multiple onChange={handleFileChange} />
              </Button>
              {files.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Selected: {files.map(f => f.name).join(', ')}
                </Typography>
              )}
              <Button type="submit" variant="contained" color="primary" disabled={loading} sx={{ fontWeight: 600, py: 1 }}>
                {loading ? <CircularProgress size={24} /> : 'Submit'}
              </Button>
              {/* PDF Viewer Toggle Button below submit */}
              {!showPdfViewer && currentPdf && (
                <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={() => setShowPdfViewer(true)}>
                  Open PDF Viewer
                </Button>
              )}
            </Box>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {result && (
              <Box sx={{ mt: 4, background: '#f5f5f5', borderRadius: 2, p: 3 }}>
                <Typography variant="h6" color="success.main" fontWeight={600}>Decision: {result.decision}</Typography>
                <Typography variant="subtitle1" sx={{ mt: 1 }}><b>Payout Amount:</b> {result.payout_amount}</Typography>
                <Typography variant="body1" sx={{ mt: 2 }}><b>Reasoning:</b> {result.reasoning}</Typography>
                <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>Relevant Clauses:</Typography>
                <List>
                  {result.clause_mapping?.map((clause, idx) => (
                    <ListItem key={idx} sx={{ pl: 0, display: 'block' }}>
                      <ListItemText
                        primary={<span
                          onContextMenu={e => handleClauseContextMenu(e, clause.clause)}
                          style={{ cursor: 'context-menu' }}
                          title="Right-click or use Ctrl+Shift+S to summarize"
                        >
                          <b>Clause {idx + 1} (Page {clause.page_number}):</b> <span style={{ fontStyle: 'italic' }}>{clause.clause}</span>
                        </span>}
                      />
                      {/* View Explanation Section */}
                      <Box sx={{ mt: 1, mb: 2, ml: 2, p: 2, bgcolor: '#fff', borderRadius: 2, boxShadow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1976d2' }}>View Explanation</Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, color: '#333' }}>
                          <b>Page Number:</b> {clause.page_number}<br />
                          <b>Context from PDF:</b> <span style={{ background: '#e3f2fd', borderRadius: 3, padding: '2px 6px' }}>{clause.context}</span>
                        </Typography>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
          {/* Floating AI Chatbox Button */}
          <Fab
            color="primary"
            aria-label="chat"
            sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 2000, boxShadow: 4 }}
            onClick={() => setChatOpen(true)}
          >
            <ChatIcon />
          </Fab>
          <Modal open={chatOpen} onClose={() => setChatOpen(false)}>
            <Box sx={{ position: 'fixed', bottom: 90, right: 40, width: 370, maxWidth: '95vw', zIndex: 2100 }}>
              <ChatBox />
            </Box>
          </Modal>
          {/* Clause Summarizer Modal/Pop-up */}
          <Modal open={summarizerOpen} onClose={() => setSummarizerOpen(false)}>
            <Box sx={{ position: 'fixed', top: summaryAnchor?.mouseY || 200, left: summaryAnchor?.mouseX || '50%', transform: 'translate(-50%, 0)', bgcolor: '#fff', p: 3, borderRadius: 3, boxShadow: 6, minWidth: 320, maxWidth: 500 }}>
              <Typography variant="h6" color="primary" fontWeight={700} gutterBottom>Clause Summarizer</Typography>
              <Typography variant="body2" sx={{ mb: 1, color: '#333' }}><b>Original:</b> {selectedText}</Typography>
              {summaryLoading && <Typography variant="body2" color="text.secondary">Summarizing...</Typography>}
              {summary && <Typography variant="body1" sx={{ mt: 1, color: '#1976d2' }}><b>Summary:</b> {summary}</Typography>}
              {summaryError && <Typography variant="body2" color="error">{summaryError}</Typography>}
              <Button onClick={() => setSummarizerOpen(false)} sx={{ mt: 2 }} variant="outlined">Close</Button>
            </Box>
          </Modal>
        </Box>
      </Container>
    </Box>
  );
}

export default App;
