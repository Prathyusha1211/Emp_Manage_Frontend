import {
  Add as AddIcon,
  CalendarMonth as CalendarMonthIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  FileDownload as FileDownloadIcon,
  Groups as GroupsIcon,
  Home as HomeIcon,
  Logout as MuiLogoutIcon,
  PersonAddAlt1 as PersonAddAlt1Icon,
  Remove as RemoveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from "@mui/icons-material";

function MuiAppIcon({ icon: Icon, color, size = 24, style }) {
  return (
    <Icon
      style={{
        color,
        display: "block",
        flexShrink: 0,
        fontSize: size,
        height: size,
        lineHeight: 1,
        width: size,
        ...style
      }}
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
