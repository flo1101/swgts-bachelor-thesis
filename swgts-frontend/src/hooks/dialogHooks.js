import {useStore} from "zustand";

export const useHandleDialog = () => {
    const {dialogText, setDialogText, showDialog, setShowDialog} = useStore((state) => ({
      dialogText: state.dialogText,
      setDialogText: state.setDialogText,
      showDialog: state.showDialog,
      setShowDialog: state.setShowDialog,
    }));

    const displayDialog = (text) => {
      setDialogText(text);
        setShowDialog(true);
    };

    const closeDialog = () => {
      setShowDialog(false);
      setDialogText("")
    };

    return {
        displayDialog,
        closeDialog,
        showDialog,
        dialogText
    };
}