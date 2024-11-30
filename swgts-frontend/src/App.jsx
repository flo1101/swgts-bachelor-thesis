import './App.css';
import axios from 'axios';
import React, { useState, useEffect } from 'react';
import LoadDataView from './components/LoadDataView.jsx';
import { uploadFASTQ } from './data/FASTQProcessing.js';
import ProgressMonitor from './components/ProgressMonitor.jsx';
import InfoDialog from './components/InfoDialog.jsx';
import GitInfo from 'react-git-info/macro';
import logo from './logo.png'; // relative path to image
import githubmark from './githubmark.png'; // relative path to image

// GIT
const gitInfo = GitInfo();

const App = () => {
  const [text, setText] = useState('App.js');
  const [serverVersionText, setServerVersionText] = useState('?');
  const [filtered, setFiltered] = useState(0);

  const [dialogText, setDialogText] = useState('?');
  const [dialogVisible, setDialogVisible] = useState(false);

  const [bufferFill, setBufferFill] = useState(0);
  const [bufferSize, setBufferSize] = useState(null);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Fetch backend version and display, verify compatibility
    axios.get('/api/server-status')
      .then((response) => {
        updateServerStatus(response);
        setBufferSize(response.data['maximum pending bytes']);
      })
      .catch((error) => {
        console.log('Unable to connect to backend');
      });
  }, []);

  const updateServerStatus = (response) => {
    setServerVersionText(response.data.commit + ' : ' + response.data.date + ' Uptime: ' + Math.round(response.data.uptime * 100) / 100 + 's');
  };

  const dialogCallback = (newText) => {
    setDialogVisible(true);
    setDialogText(newText);
  };

  const updateProgress = (progress) => {
    setProgress((prevProgress) => prevProgress + progress);
  };

  const updateTotal = (total) => {
    setTotal(total);
  };

  const updateBufferFill = (total) => {
    setBufferFill(total);
  };

  const updateFiltered = (total) => {
    setFiltered(total);
  };

  const closeDialog = () => {
    setDialogVisible(false);
  };

  const initiateUpload = (fileList, download) => {
    setUploading(true);
    setFiltered(0);
    setProgress(0);
    uploadFASTQ(fileList, download, updateProgress, updateTotal, updateBufferFill, updateFiltered, dialogCallback, bufferSize)
      .then(() => setUploading(false));
  };

  return (
    <div className="App">
      <small>{'SWGTS Demo, Version: ' + gitInfo.commit.date}</small>
      <br />
      <img src={logo} width="128" />
      <br />
      <a href="https://github.com/AlBi-HHU/swgts"><img src={githubmark} width="64" /></a>
      <br />
      <small>Server Version: {serverVersionText}</small>
      {!uploading && <LoadDataView className="ldv" dialogCallback={dialogCallback} initiate_upload={initiateUpload} />}
      {dialogVisible && <InfoDialog text={dialogText} closeInfoDialog={closeDialog} />}
      {uploading && (
        <ProgressMonitor
          dialogCallback={dialogCallback}
          buffer_size={bufferSize}
          total={total}
          progress={progress}
          filtered={filtered}
          buffer_fill={bufferFill}
        />
      )}
    </div>
  );
};

export default App;