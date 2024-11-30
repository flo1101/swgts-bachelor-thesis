import React from 'react';
import { LinearProgress } from '@mui/material';

const ProgressMonitor = ({filtered, progress, bufferFill, total, bufferSize}) => {
  const filteredPercentage = (filtered / Math.max(total, 1)) * 100;
  const progressPercentage = (progress / Math.max(total, 1)) * 100;
  const bufferFillPercentage = (bufferFill / Math.max(bufferSize, 1)) * 100;

  return (
    <>
      <LinearProgress
        variant="buffer"
        value={filteredPercentage}
        sx={{ height: "10px" }}
        valueBuffer={progressPercentage}
    />
      {progress}/{total} transferred ({filtered} filtered)
      <LinearProgress
        variant="determinate"
        value={bufferFillPercentage}
        sx={{ height: "10px" }}
        color="secondary"
      />
      {bufferFill}/{bufferSize} bytes in buffer
    </>
  );
}

export default ProgressMonitor;