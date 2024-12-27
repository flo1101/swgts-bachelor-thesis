import IconCancel from "../../../assets/icons/IconCancel";

const SelectedFiles = ({ files, deleteFile }) => {
  const getBoxForFile = (file, key) => (
    <div className="selected-file" key={key}>
      {file?.name}
      <span onClick={() => deleteFile(file?.name)}>
        <IconCancel width={25} />
      </span>
    </div>
  );

  return (
    <div className={"selected-files"}>
      {files.map((file, key) => getBoxForFile(file, key))}
    </div>
  );
};
export default SelectedFiles;
