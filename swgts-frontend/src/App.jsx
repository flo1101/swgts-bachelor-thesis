import "./App.css";
import React, { useState } from "react";
import UploadView from "./components/UploadView/UploadView.jsx";
import InfoDialog from "./components/InfoDialog.jsx";
import { useGetServerConfig } from "./hooks/serverConfigHooks";
import {useHandleDialog} from "./hooks/dialogHooks";

const App = () => {
  const {dialogText, showDialog, closeDialog} = useHandleDialog()

  const {
    serverConfig,
    serverConfigIsLoading,
    serverConfigError,
    fetchServerConfig,
  } = useGetServerConfig();
  const { bufferSize } = serverConfig;

  return (
    <div className="App">
      <UploadView
        bufferSize={bufferSize}
      />
      {showDialog && (
        <InfoDialog text={dialogText} close={closeDialog} />
      )}
    </div>
  );
};

export default App;
