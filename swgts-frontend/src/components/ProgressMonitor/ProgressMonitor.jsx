import React from "react";
import ProgressBar from "./components/ProgressBar";
import "./style.scss";
import Button from "../Button/Button";

const ProgressMonitor = ({
  uploadStatus,
  initNewUpload,
  readsProgressed,
  readsTotal,
  bufferFill,
  bufferSize,
}) => {
  const getHeadline = () => {
    switch (uploadStatus) {
      case "UPLOADING":
        return "Uploading ...";
      case "SUCCESS":
        return "Upload finished";
      case "ERROR":
        return "Error during upload";
      default:
        return "No upload";
    }
  };

  return (
    <div className={"progress-monitor"}>
      <h1>{getHeadline()}</h1>
      <div className="content">
        <ProgressBar
          className={"upload-progress"}
          labels={[`Progress: ${readsProgressed}/${readsTotal} reads`]}
          total={readsTotal}
          progress={readsProgressed}
        />
        <ProgressBar
          className={"buffer-fill"}
          labels={[`Buffer fill: ${bufferFill}/${bufferSize} bytes`]}
          total={bufferSize}
          progress={bufferFill}
        />
        {uploadStatus === "SUCCESS" && (
          <div className={"upload-buttons"}>
            <Button
              className={"new-upload-button"}
              label={"New upload"}
              onClick={initNewUpload}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressMonitor;
