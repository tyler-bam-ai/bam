import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
    Video,
    Upload,
    Mic,
    Key,
    CheckCircle,
    Circle,
    Play,
    Square,
    Pause,
    Monitor,
    FileText,
    Loader2,
    X,
    Check,
    AlertCircle,
    HelpCircle,
    MessageCircle,
    Send,
    Clock,
    Archive
} from 'lucide-react';
import { useDemoMode } from '../contexts/DemoModeContext';
import { useClientContext } from '../contexts/ClientContext';
import { API_URL } from '../config';
import './KnowledgeProvider.css';

// Sub-pages
function ScreenRecorder() {
    const [sources, setSources] = useState([]);
    const [selectedSource, setSelectedSource] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [permissionStatus, setPermissionStatus] = useState({ screen: false, microphone: false });
    const [loading, setLoading] = useState(true);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    useEffect(() => {
        checkPermissionsAndLoadSources();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    async function checkPermissionsAndLoadSources() {
        try {
            if (window.electronAPI) {
                const perms = await window.electronAPI.recording.checkPermissions();
                setPermissionStatus(perms);

                const sources = await window.electronAPI.recording.getSources();
                setSources(sources);
            }
        } catch (error) {
            console.error('Error loading sources:', error);
        } finally {
            setLoading(false);
        }
    }

    async function startRecording() {
        if (!selectedSource) return;

        try {
            // Get screen stream
            const screenStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSource.id
                    }
                }
            });

            // Get audio stream
            let audioStream = null;
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true
                    },
                    video: false
                });
            } catch (e) {
                console.warn('Could not get microphone access:', e);
            }

            // Combine streams
            const tracks = [...screenStream.getTracks()];
            if (audioStream) {
                tracks.push(...audioStream.getTracks());
            }

            const combinedStream = new MediaStream(tracks);
            streamRef.current = combinedStream;

            // Setup media recorder
            const mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp9'
            });

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                await saveRecording(blob);
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            setIsPaused(false);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Failed to start recording. Please check permissions.');
        }
    }

    function pauseRecording() {
        if (mediaRecorderRef.current && isRecording) {
            if (isPaused) {
                mediaRecorderRef.current.resume();
                timerRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);
            } else {
                mediaRecorderRef.current.pause();
                clearInterval(timerRef.current);
            }
            setIsPaused(!isPaused);
        }
    }

    function stopRecording() {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            streamRef.current?.getTracks().forEach(track => track.stop());
            clearInterval(timerRef.current);
            setIsRecording(false);
            setIsPaused(false);
        }
    }

    async function saveRecording(blob) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const filename = `recording-${Date.now()}.webm`;

            // Save locally via Electron
            if (window.electronAPI) {
                const filePath = await window.electronAPI.fs.saveRecording({
                    buffer: arrayBuffer,
                    filename
                });
                console.log('Recording saved to:', filePath);
            }

            // Upload to backend
            try {
                const token = localStorage.getItem('token');
                const formData = new FormData();
                formData.append('video', blob, filename);
                formData.append('title', `Screen Recording - ${new Date().toLocaleString()}`);
                formData.append('duration', recordingTime.toString());
                formData.append('source', selectedSource?.name || 'Screen');

                const response = await fetch('http://localhost:3001/api/knowledge/video', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Recording uploaded to backend:', data.id);
                } else {
                    console.error('Failed to upload recording to backend');
                }
            } catch (uploadError) {
                console.error('Backend upload error:', uploadError);
            }

            setRecordingTime(0);
        } catch (error) {
            console.error('Error saving recording:', error);
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    if (loading) {
        return (
            <div className="recorder-loading">
                <Loader2 className="animate-spin" size={32} />
                <p>Loading screen sources...</p>
            </div>
        );
    }

    return (
        <div className="screen-recorder">
            {!isRecording ? (
                <>
                    <div className="source-selector">
                        <h3>Select a screen or window to record</h3>
                        <div className="source-grid">
                            {sources.map((source) => (
                                <button
                                    key={source.id}
                                    className={`source-item ${selectedSource?.id === source.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedSource(source)}
                                >
                                    <img src={source.thumbnail} alt={source.name} className="source-thumbnail" />
                                    <span className="source-name">{source.name}</span>
                                    {selectedSource?.id === source.id && (
                                        <div className="source-selected-badge">
                                            <Check size={14} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="recorder-actions">
                        <button
                            className="btn btn-primary btn-lg record-btn"
                            onClick={startRecording}
                            disabled={!selectedSource}
                        >
                            <div className="record-dot"></div>
                            Start Recording
                        </button>
                    </div>
                </>
            ) : (
                <div className="recording-active">
                    <div className="recording-preview">
                        <Monitor size={64} />
                        <p>Recording: {selectedSource?.name}</p>
                    </div>

                    <div className="recording-timer">
                        <div className={`recording-indicator ${isPaused ? 'paused' : ''}`}></div>
                        <span className="timer-display">{formatTime(recordingTime)}</span>
                    </div>

                    <div className="recording-controls">
                        <button
                            className="btn btn-secondary btn-icon"
                            onClick={pauseRecording}
                            title={isPaused ? 'Resume' : 'Pause'}
                        >
                            {isPaused ? <Play size={20} /> : <Pause size={20} />}
                        </button>
                        <button
                            className="btn btn-danger btn-lg"
                            onClick={stopRecording}
                        >
                            <Square size={18} />
                            Stop Recording
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Demo files for DocumentUploader
const DEMO_FILES = [
    { id: 'demo-1', name: 'Sales_Process_Guide.pdf', size: 2456000, type: 'application/pdf', status: 'complete', progress: 100 },
    { id: 'demo-2', name: 'Customer_Service_Handbook.docx', size: 1823000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', status: 'complete', progress: 100 },
    { id: 'demo-3', name: 'Product_Catalog_2024.xlsx', size: 3200000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'complete', progress: 100 },
    { id: 'demo-4', name: 'Onboarding_Presentation.pptx', size: 5100000, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', status: 'complete', progress: 100 },
    { id: 'demo-5', name: 'Company_Policies.pdf', size: 890000, type: 'application/pdf', status: 'complete', progress: 100 },
];

function DocumentUploader({ isDemoMode }) {
    const [files, setFiles] = useState(isDemoMode ? DEMO_FILES : []);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isDemoMode) {
            setFiles(DEMO_FILES);
        } else {
            setFiles([]);
        }
    }, [isDemoMode]);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const handleFiles = (newFiles) => {
        const fileObjects = newFiles.map(file => ({
            id: `${file.name}-${Date.now()}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending', // pending, uploading, complete, error
            progress: 0
        }));

        setFiles(prev => [...prev, ...fileObjects]);

        // Upload each file to backend
        fileObjects.forEach(fileObj => {
            uploadToBackend(fileObj);
        });
    };

    const uploadToBackend = async (fileObj) => {
        // Use imported API_URL and get client ID
        const clientId = localStorage.getItem('selectedClientId') || localStorage.getItem('companyId') || 'demo';

        // Update to uploading status
        setFiles(prev => prev.map(f =>
            f.id === fileObj.id ? { ...f, status: 'uploading', progress: 10 } : f
        ));

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', fileObj.file);
            formData.append('title', fileObj.name);
            formData.append('clientId', clientId);

            setFiles(prev => prev.map(f =>
                f.id === fileObj.id ? { ...f, progress: 30 } : f
            ));

            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}/api/knowledge/document`, {
                method: 'POST',
                headers,
                body: formData
            });

            setFiles(prev => prev.map(f =>
                f.id === fileObj.id ? { ...f, progress: 70 } : f
            ));

            if (response.ok) {
                const data = await response.json();
                setFiles(prev => prev.map(f =>
                    f.id === fileObj.id ? {
                        ...f,
                        status: 'complete',
                        progress: 100,
                        backendId: data.item?.id,
                        preview: data.item?.preview,
                        wordCount: data.item?.wordCount
                    } : f
                ));
            } else {
                const errorData = await response.json().catch(() => ({}));
                setFiles(prev => prev.map(f =>
                    f.id === fileObj.id ? { ...f, status: 'error', progress: 0, error: errorData.error } : f
                ));
            }
        } catch (error) {
            console.error('Upload error:', error);
            setFiles(prev => prev.map(f =>
                f.id === fileObj.id ? { ...f, status: 'error', progress: 0, error: error.message } : f
            ));
        }
    };

    const removeFile = (fileId) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (type) => {
        if (type.includes('pdf')) return '📄';
        if (type.includes('word') || type.includes('document')) return '📝';
        if (type.includes('sheet') || type.includes('excel')) return '📊';
        if (type.includes('presentation') || type.includes('powerpoint')) return '📽️';
        if (type.includes('image')) return '🖼️';
        return '📎';
    };

    return (
        <div className="document-uploader">
            <div
                className={`upload-zone ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    onChange={handleChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                />
                <Upload size={48} className="upload-icon" />
                <h3>Drop files here or click to upload</h3>
                <p>Supports PDF, Word, Excel, PowerPoint, Text, Markdown, and Images</p>
            </div>

            {files.length > 0 && (
                <div className="upload-list">
                    <h4>Uploaded Files</h4>
                    {files.map((file) => (
                        <div key={file.id} className="upload-item">
                            <span className="file-icon">{getFileIcon(file.type)}</span>
                            <div className="file-info">
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{formatSize(file.size)}</span>
                            </div>
                            <div className="file-status">
                                {file.status === 'uploading' && (
                                    <div className="upload-progress">
                                        <div
                                            className="upload-progress-bar"
                                            style={{ width: `${file.progress}%` }}
                                        ></div>
                                    </div>
                                )}
                                {file.status === 'complete' && (
                                    <CheckCircle size={20} className="status-complete" />
                                )}
                                {file.status === 'error' && (
                                    <AlertCircle size={20} className="status-error" />
                                )}
                            </div>
                            <button
                                className="btn btn-ghost btn-sm btn-icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(file.id);
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Demo voice recordings
const DEMO_RECORDINGS = [
    { id: 1, url: null, duration: 45, name: 'CRM Walkthrough Explanation', date: '2024-12-20T10:30:00Z' },
    { id: 2, url: null, duration: 120, name: 'Refund Process Steps', date: '2024-12-21T14:15:00Z' },
    { id: 3, url: null, duration: 90, name: 'Customer Escalation Protocol', date: '2024-12-22T09:45:00Z' },
];

function VoiceRecorder({ isDemoMode }) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordings, setRecordings] = useState(isDemoMode ? DEMO_RECORDINGS : []);
    const [debugLog, setDebugLog] = useState([]);
    const [audioLevel, setAudioLevel] = useState(0);
    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const chunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const canvasRef = useRef(null);

    // Use imported API_URL and client context hook
    const { selectedClient } = useClientContext();

    // Add debug log entry
    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setDebugLog(prev => [...prev.slice(-10), { timestamp, message, type }]);
        console.log(`[VOICE ${type.toUpperCase()}] ${message}`);
    };

    useEffect(() => {
        if (isDemoMode) {
            setRecordings(DEMO_RECORDINGS);
        } else {
            setRecordings([]);
        }
    }, [isDemoMode]);

    // Draw waveform on canvas
    const drawWaveform = () => {
        if (!analyserRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isRecording) return;
            animationRef.current = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            // Calculate average level
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            setAudioLevel(average / 255);

            // Clear canvas
            ctx.fillStyle = 'rgba(26, 29, 41, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw waveform bars
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

                // Gradient color from purple to pink
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                gradient.addColorStop(0, '#a855f7');
                gradient.addColorStop(1, '#ec4899');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        };

        draw();
    };

    async function startRecording() {
        addLog('Starting recording...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            addLog('Microphone access granted');

            // Set up audio analyzer for waveform
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                addLog('Recording stopped, processing...');

                // Stop waveform animation
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }

                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const recordingId = Date.now();
                const name = `Voice Memo ${recordings.length + 1}`;

                addLog(`Created blob: ${(blob.size / 1024).toFixed(1)} KB`);

                // Add to local state immediately with "transcribing" status
                setRecordings(prev => [...prev, {
                    id: recordingId,
                    url,
                    duration: recordingTime,
                    name,
                    date: new Date().toISOString(),
                    status: 'transcribing',
                    transcription: null
                }]);

                // Get client ID (use selected client or default)
                const clientId = selectedClient?.id || localStorage.getItem('companyId') || 'demo';
                addLog(`Client ID: ${clientId}`);

                // Upload to Railway backend for transcription
                const uploadUrl = `${API_URL}/api/knowledge/voice`;
                addLog(`Uploading to: ${uploadUrl}`);

                try {
                    const token = localStorage.getItem('token');
                    const openaiKey = localStorage.getItem('openai_api_key');

                    addLog(`Token: ${token ? 'present' : 'missing'}`);
                    addLog(`OpenAI Key: ${openaiKey ? 'present' : 'missing'}`);

                    const formData = new FormData();
                    formData.append('audio', blob, `${name}.webm`);
                    formData.append('title', name);
                    formData.append('duration', recordingTime.toString());
                    formData.append('clientId', clientId);

                    const headers = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    if (openaiKey) headers['X-OpenAI-Key'] = openaiKey;

                    addLog('Sending request...');

                    const response = await fetch(uploadUrl, {
                        method: 'POST',
                        headers,
                        body: formData
                    });

                    addLog(`Response status: ${response.status}`);

                    if (response.ok) {
                        const data = await response.json();
                        addLog(`Success! Transcribed ${data.item?.wordCount || 0} words`, 'success');
                        setRecordings(prev => prev.map(r =>
                            r.id === recordingId
                                ? {
                                    ...r,
                                    status: 'complete',
                                    backendId: data.item?.id,
                                    transcription: data.item?.transcription || '[Transcription complete]',
                                    wordCount: data.item?.wordCount || 0
                                }
                                : r
                        ));
                    } else {
                        const errorText = await response.text();
                        addLog(`Server error: ${response.status} - ${errorText}`, 'error');
                        setRecordings(prev => prev.map(r =>
                            r.id === recordingId
                                ? { ...r, status: 'error', error: `HTTP ${response.status}` }
                                : r
                        ));
                    }
                } catch (error) {
                    addLog(`Network error: ${error.message}`, 'error');
                    addLog(`URL was: ${uploadUrl}`, 'error');
                    setRecordings(prev => prev.map(r =>
                        r.id === recordingId ? { ...r, status: 'error', error: error.message } : r
                    ));
                }

                stream.getTracks().forEach(track => track.stop());
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            addLog('Recording started');

            // Start waveform visualization
            setTimeout(drawWaveform, 100);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            addLog(`Microphone error: ${error.message}`, 'error');
            alert('Could not access microphone');
        }
    }

    function stopRecording() {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            clearInterval(timerRef.current);
            setIsRecording(false);
            setRecordingTime(0);
            setAudioLevel(0);
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    return (
        <div className="voice-recorder">
            {/* Recording Section */}
            <div className="voice-recorder-main">
                <div className={`mic-button ${isRecording ? 'recording' : ''}`}>
                    <button
                        className="mic-btn"
                        onClick={isRecording ? stopRecording : startRecording}
                    >
                        {isRecording ? <Square size={32} /> : <Mic size={32} />}
                    </button>
                    {isRecording && (
                        <div className="mic-waves">
                            <span></span><span></span><span></span>
                        </div>
                    )}
                </div>

                {isRecording ? (
                    <div className="recording-status">
                        <span className="recording-dot"></span>
                        Recording... {formatTime(recordingTime)}
                    </div>
                ) : (
                    <p className="mic-instruction">Click to start voice recording</p>
                )}
            </div>

            {/* Collapsible Debug Log - only show if there are errors */}
            {debugLog.some(log => log.type === 'error') && (
                <details className="debug-log-panel">
                    <summary>⚠️ Debug Log (click to expand)</summary>
                    <div className="debug-log-entries">
                        {debugLog.map((log, i) => (
                            <div key={i} className={`debug-log-entry ${log.type}`}>
                                <span className="debug-time">{log.timestamp}</span>
                                <span className="debug-msg">{log.message}</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {/* Recordings List */}
            {recordings.length > 0 && (
                <div className="recordings-list">
                    <h4>Recorded Memos</h4>
                    {recordings.map((rec) => (
                        <div key={rec.id} className={`recording-item ${rec.status || ''}`}>
                            <Mic size={20} />
                            <div className="recording-info">
                                <span className="recording-name">{rec.name}</span>
                                <span className="recording-duration">{formatTime(rec.duration)}</span>
                            </div>

                            {/* Transcription Status */}
                            {rec.status === 'transcribing' && (
                                <div className="transcription-status transcribing">
                                    <Loader2 size={16} className="spin" />
                                    <span>Transcribing...</span>
                                </div>
                            )}

                            {rec.status === 'complete' && rec.transcription && (
                                <div className="transcription-status complete">
                                    <CheckCircle size={16} />
                                    <span className="transcription-preview">
                                        {rec.transcription}
                                    </span>
                                    {rec.wordCount > 0 && (
                                        <span className="word-count">{rec.wordCount} words</span>
                                    )}
                                </div>
                            )}

                            {rec.status === 'error' && (
                                <div className="transcription-status error">
                                    <AlertCircle size={16} />
                                    <span>{rec.error || 'Transcription failed'}</span>
                                </div>
                            )}

                            <audio controls src={rec.url} className="recording-audio"></audio>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


function APIKeySetup() {
    const [services] = useState([
        { id: 'google', name: 'Google Workspace', icon: '🔵', connected: true },
        { id: 'quickbooks', name: 'QuickBooks', icon: '💚', connected: false },
        { id: 'salesforce', name: 'Salesforce', icon: '☁️', connected: false },
    ]);

    return (
        <div className="api-setup">
            <div className="api-header">
                <h3>Connected Services</h3>
                <p>Connect your business tools to enable AI automation</p>
            </div>

            <div className="api-list">
                {services.map((service) => (
                    <div key={service.id} className="api-item">
                        <span className="api-icon">{service.icon}</span>
                        <div className="api-info">
                            <span className="api-name">{service.name}</span>
                            <span className={`api-status ${service.connected ? 'connected' : ''}`}>
                                {service.connected ? 'Connected' : 'Not connected'}
                            </span>
                        </div>
                        <button className={`btn ${service.connected ? 'btn-secondary' : 'btn-primary'}`}>
                            {service.connected ? 'Manage' : 'Connect'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Demo unanswered questions for Knowledge Gaps
const DEMO_KNOWLEDGE_GAPS = [
    {
        id: 'gap-1',
        question: 'How do I process a refund for a customer who paid with crypto?',
        askedBy: 'Sarah from Sales',
        askedAt: '2 hours ago',
        attempts: 3,
        context: 'Customer paid with Bitcoin through our payment processor but wants a refund in USD.',
        urgency: 'high'
    },
    {
        id: 'gap-2',
        question: 'What is our policy for returns after 90 days?',
        askedBy: 'Mike from Support',
        askedAt: '5 hours ago',
        attempts: 2,
        context: 'Customer claims product was defective but is outside return window.',
        urgency: 'medium'
    },
    {
        id: 'gap-3',
        question: 'How do I set up automated email sequences in our CRM?',
        askedBy: 'Lisa from Marketing',
        askedAt: '1 day ago',
        attempts: 4,
        context: 'Trying to create a drip campaign for new leads.',
        urgency: 'low'
    },
    {
        id: 'gap-4',
        question: 'What discount structure can we offer enterprise clients?',
        askedBy: 'Tom from Sales',
        askedAt: '2 days ago',
        attempts: 1,
        context: 'Potential customer wants pricing for 500+ seats.',
        urgency: 'high'
    },
];

function KnowledgeGaps({ isDemoMode }) {
    const [gaps, setGaps] = useState(isDemoMode ? DEMO_KNOWLEDGE_GAPS : []);
    const [selectedGap, setSelectedGap] = useState(null);
    const [answerText, setAnswerText] = useState('');
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (isDemoMode) {
            setGaps(DEMO_KNOWLEDGE_GAPS);
        } else {
            setGaps([]);
        }
    }, [isDemoMode]);

    const filteredGaps = filter === 'all'
        ? gaps
        : gaps.filter(g => g.urgency === filter);

    const getUrgencyColor = (urgency) => {
        switch (urgency) {
            case 'high': return 'var(--color-error, #ef4444)';
            case 'medium': return 'var(--color-warning, #eab308)';
            default: return 'var(--color-info, #3b82f6)';
        }
    };

    const handleSubmitAnswer = (gapId) => {
        if (!answerText.trim()) return;

        // In real implementation, this would submit to backend
        setGaps(prev => prev.filter(g => g.id !== gapId));
        setSelectedGap(null);
        setAnswerText('');
        alert('Answer submitted! The AI will now use this knowledge to answer similar questions.');
    };

    const handleArchive = (gapId) => {
        setGaps(prev => prev.filter(g => g.id !== gapId));
        if (selectedGap?.id === gapId) {
            setSelectedGap(null);
        }
    };

    return (
        <div className="knowledge-gaps">
            <div className="gaps-header">
                <div className="gaps-title">
                    <HelpCircle size={24} />
                    <div>
                        <h3>Brain Fog</h3>
                        <p>Questions your AI couldn't answer. Help train your brain by providing answers!</p>
                    </div>
                </div>
                <div className="gaps-count">
                    <span className="count-badge">{gaps.length}</span>
                    pending
                </div>
            </div>

            <div className="gaps-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All ({gaps.length})
                </button>
                <button
                    className={`filter-btn ${filter === 'high' ? 'active' : ''}`}
                    onClick={() => setFilter('high')}
                >
                    🔴 High Priority ({gaps.filter(g => g.urgency === 'high').length})
                </button>
                <button
                    className={`filter-btn ${filter === 'medium' ? 'active' : ''}`}
                    onClick={() => setFilter('medium')}
                >
                    🟡 Medium ({gaps.filter(g => g.urgency === 'medium').length})
                </button>
                <button
                    className={`filter-btn ${filter === 'low' ? 'active' : ''}`}
                    onClick={() => setFilter('low')}
                >
                    🔵 Low ({gaps.filter(g => g.urgency === 'low').length})
                </button>
            </div>

            <div className="gaps-layout">
                <div className="gaps-list">
                    {filteredGaps.length > 0 ? (
                        filteredGaps.map(gap => (
                            <div
                                key={gap.id}
                                className={`gap-card ${selectedGap?.id === gap.id ? 'selected' : ''}`}
                                onClick={() => setSelectedGap(gap)}
                            >
                                <div className="gap-urgency" style={{ backgroundColor: getUrgencyColor(gap.urgency) }} />
                                <div className="gap-content">
                                    <p className="gap-question">{gap.question}</p>
                                    <div className="gap-meta">
                                        <span className="gap-asker">
                                            <MessageCircle size={12} />
                                            {gap.askedBy}
                                        </span>
                                        <span className="gap-time">
                                            <Clock size={12} />
                                            {gap.askedAt}
                                        </span>
                                        <span className="gap-attempts">
                                            {gap.attempts} attempt{gap.attempts > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm btn-icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleArchive(gap.id);
                                    }}
                                    title="Archive (don't answer)"
                                >
                                    <Archive size={16} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="gaps-empty">
                            <CheckCircle size={48} />
                            <h4>All caught up!</h4>
                            <p>No unanswered questions right now</p>
                        </div>
                    )}
                </div>

                {selectedGap && (
                    <div className="gap-detail">
                        <div className="detail-header">
                            <h4>Answer this question</h4>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setSelectedGap(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="detail-question">
                            <p className="question-text">{selectedGap.question}</p>
                            <div className="question-context">
                                <strong>Context:</strong> {selectedGap.context}
                            </div>
                        </div>

                        <div className="answer-form">
                            <label>Your Answer</label>
                            <textarea
                                value={answerText}
                                onChange={(e) => setAnswerText(e.target.value)}
                                placeholder="Type your answer here. This will train the AI to answer similar questions in the future..."
                                rows={6}
                            />
                            <div className="answer-actions">
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => handleArchive(selectedGap.id)}
                                >
                                    <Archive size={16} />
                                    Skip
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleSubmitAnswer(selectedGap.id)}
                                    disabled={!answerText.trim()}
                                >
                                    <Send size={16} />
                                    Submit Answer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Main Knowledge Provider Component
function KnowledgeProvider() {
    const navigate = useNavigate();
    const { isDemoMode } = useDemoMode();

    // Knowledge score breakdown - password-strength style metrics
    const knowledgeScores = isDemoMode ? {
        documents: { score: 85, items: 12, label: 'Documents' },
        voice: { score: 70, items: 5, label: 'Voice Recordings' },
        api: { score: 50, items: 2, label: 'API Connections' },
    } : {
        documents: { score: 0, items: 0, label: 'Documents' },
        voice: { score: 0, items: 0, label: 'Voice Recordings' },
        api: { score: 0, items: 0, label: 'API Connections' },
    };

    // Overall knowledge score (weighted average)
    const overallScore = isDemoMode
        ? Math.round((knowledgeScores.documents.score * 0.4) + (knowledgeScores.voice.score * 0.35) + (knowledgeScores.api.score * 0.25))
        : 0;

    // Get strength level and color based on score
    const getStrengthLevel = (score) => {
        if (score >= 80) return { level: 'Strong', color: 'var(--color-success, #22c55e)', bars: 4 };
        if (score >= 60) return { level: 'Good', color: 'var(--color-info, #3b82f6)', bars: 3 };
        if (score >= 40) return { level: 'Fair', color: 'var(--color-warning, #eab308)', bars: 2 };
        if (score > 0) return { level: 'Weak', color: 'var(--color-error, #ef4444)', bars: 1 };
        return { level: 'Empty', color: 'var(--color-text-muted, #6b7280)', bars: 0 };
    };

    const strength = getStrengthLevel(overallScore);

    // Status message based on score
    const getStatusMessage = (score) => {
        if (score >= 80) return '🎉 Brain is ready! You can test and deliver.';
        if (score >= 60) return '💪 Good progress! Add more voice recordings to strengthen.';
        if (score >= 40) return '📈 Getting there! Upload more documents.';
        if (score > 0) return '🚀 Great start! Keep adding knowledge.';
        return '👋 Welcome! Start by uploading documents or recording explanations.';
    };

    return (
        <div className="knowledge-provider">
            {/* Knowledge Score Card */}
            <div className="onboarding-card animate-slideUp">
                <div className="knowledge-score-header">
                    <div className="score-title">
                        <h3>Knowledge Score</h3>
                        <p className="brain-training-explainer">
                            Train your AI brain by uploading documents, recording explanations, and connecting tools.
                        </p>
                    </div>
                    <div className="score-meter">
                        <div className="score-value" style={{ color: strength.color }}>
                            {overallScore}%
                        </div>
                        <div className="strength-bars">
                            {[1, 2, 3, 4].map((bar) => (
                                <div
                                    key={bar}
                                    className="strength-bar"
                                    style={{
                                        backgroundColor: bar <= strength.bars ? strength.color : 'var(--color-bg-tertiary, #2a2f3e)'
                                    }}
                                />
                            ))}
                        </div>
                        <span className="strength-label" style={{ color: strength.color }}>
                            {strength.level}
                        </span>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="score-breakdown">
                    {Object.entries(knowledgeScores).map(([key, data]) => {
                        const catStrength = getStrengthLevel(data.score);
                        return (
                            <div key={key} className="score-category">
                                <div className="category-header">
                                    <span className="category-label">{data.label}</span>
                                    <span className="category-count">{data.items} items</span>
                                </div>
                                <div className="category-bar">
                                    <div
                                        className="category-fill"
                                        style={{
                                            width: `${data.score}%`,
                                            backgroundColor: catStrength.color
                                        }}
                                    />
                                </div>
                                <span className="category-score">{data.score}%</span>
                            </div>
                        );
                    })}
                </div>

                {/* Status Message */}
                <div className="score-status">
                    {getStatusMessage(overallScore)}
                </div>
            </div>

            {/* Sub-navigation */}
            <nav className="provider-nav animate-slideUp" style={{ animationDelay: '0.1s' }}>
                <NavLink to="/provider" end className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                    <Video size={18} />
                    Screen Recording
                </NavLink>
                <NavLink to="/provider/upload" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                    <Upload size={18} />
                    Documents
                </NavLink>
                <NavLink to="/provider/voice" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                    <Mic size={18} />
                    Voice Memos
                </NavLink>
                <NavLink to="/provider/api" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                    <Key size={18} />
                    API Setup
                </NavLink>
                <NavLink to="/provider/gaps" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''} gaps-tab`}>
                    <HelpCircle size={18} />
                    Brain Fog
                    {isDemoMode && <span className="gaps-badge">4</span>}
                </NavLink>
            </nav>

            {/* Content Area */}
            <div className="provider-content animate-slideUp" style={{ animationDelay: '0.15s' }}>
                <Routes>
                    <Route index element={<ScreenRecorder isDemoMode={isDemoMode} />} />
                    <Route path="upload" element={<DocumentUploader isDemoMode={isDemoMode} />} />
                    <Route path="voice" element={<VoiceRecorder isDemoMode={isDemoMode} />} />
                    <Route path="api" element={<APIKeySetup isDemoMode={isDemoMode} />} />
                    <Route path="gaps" element={<KnowledgeGaps isDemoMode={isDemoMode} />} />
                </Routes>
            </div>
        </div>
    );
}

export default KnowledgeProvider;

