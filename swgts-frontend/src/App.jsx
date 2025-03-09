import "./App.css";
import React from "react";
import UploadView from "./components/UploadView/UploadView.jsx";
import InfoDialog from "./components/InfoDialog.jsx";
import { useGetServerConfig } from "./hooks/serverConfigHooks";
import { useHandleDialog } from "./hooks/dialogHooks";

const App = () => {
  const { dialogText, showDialog, closeDialog } = useHandleDialog();

  const {
    serverConfig,
    serverConfigIsLoading,
    serverConfigError,
    fetchServerConfig,
  } = useGetServerConfig();
  const { bufferSize, requestSize } = serverConfig || {};

  return (
    <div className="App">
      <UploadView bufferSize={bufferSize} requestSize={requestSize} />
      {showDialog && <InfoDialog text={dialogText} close={closeDialog} />}
    </div>
  );
};

export default App;
