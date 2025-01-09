import React from 'react';
import { LinearProgress } from '@mui/material';

const ProgressMonitor = ({readsFiltered, readsProgressed, readsTotal, bufferFill, bufferSize}) => {
  const filteredPercentage = (readsFiltered / Math.max(readsTotal, 1)) * 100;
  const progressedPercentage = (readsProgressed / Math.max(readsTotal, 1)) * 100;
  const bufferFillPercentage = (bufferFill / Math.max(bufferSize, 1)) * 100;

  return (
    <>
      <LinearProgress
        variant="buffer"
        value={filteredPercentage}
        sx={{ height: "10px" }}
        valueBuffer={progressedPercentage}
    />
      {readsProgressed}/{readsTotal} transferred ({readsFiltered} filtered)
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