import React from 'react';

import {Button} from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

const InfoDialog = ({text, closeInfoDialog}) => {
     //TODO: Localization applied to strings
    return (
      <Dialog
        open={true}
        onClose={closeInfoDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Info"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {text}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeInfoDialog} color="primary">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    );
}

export default InfoDialog;
