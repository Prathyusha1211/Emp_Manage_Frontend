import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const iconNames = {
  add: "add",
  calendar: "calendar-month",
  check: "check",
  checkCircle: "check-circle",
  chevronLeft: "chevron-left",
  chevronRight: "chevron-right",
  close: "close",
  currencyRupee: "currency-rupee",
  delete: "delete",
  edit: "edit",
  expandMore: "expand-more",
  fileDownload: "file-download",
  groups: "groups",
  home: "home",
  logout: "logout",
  personAdd: "person-add-alt",
  remove: "remove",
  visibility: "visibility",
  visibilityOff: "visibility-off"
};

const AddIcon = "add";
const CalendarMonthIcon = "calendar";
const CheckIcon = "check";
const CheckCircleIcon = "checkCircle";
const ChevronLeftIcon = "chevronLeft";
const ChevronRightIcon = "chevronRight";
const CloseIcon = "close";
const CurrencyRupeeIcon = "currencyRupee";
const DeleteIcon = "delete";
const EditIcon = "edit";
const ExpandMoreIcon = "expandMore";
const FileDownloadIcon = "fileDownload";
const GroupsIcon = "groups";
const HomeIcon = "home";
const MuiLogoutIcon = "logout";
const PersonAddAlt1Icon = "personAdd";
const RemoveIcon = "remove";
const VisibilityIcon = "visibility";
const VisibilityOffIcon = "visibilityOff";

function MuiAppIcon({ icon, color = "#08519C", size = 24, style }) {
  const iconStyle =
    typeof style?.transform === "string"
      ? {
          ...style,
          transform: [{ rotate: style.transform.replace("rotate(", "").replace(")", "") }]
        }
      : style;

  return (
    <MaterialIcons
      name={iconNames[icon]}
      color={color}
      size={size}
      style={iconStyle}
    />
  );
}

export {
  AddIcon,
  CalendarMonthIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CurrencyRupeeIcon,
  DeleteIcon,
  EditIcon,
  ExpandMoreIcon,
  FileDownloadIcon,
  GroupsIcon,
  HomeIcon,
  MuiAppIcon,
  MuiLogoutIcon,
  PersonAddAlt1Icon,
  RemoveIcon,
  VisibilityIcon,
  VisibilityOffIcon
};
