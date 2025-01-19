import React from "react";
import ProgressBar from "./components/ProgressBar";
import "./style.scss";

const ProgressMonitor = ({
  readsProgressed,
  readsTotal,
  bufferFill,
  bufferSize,
}) => {
  return (
    <div className={"progress-monitor"}>
      <h1>Uploading...</h1>
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
      </div>
    </div>
  );
};

export default ProgressMonitor;
