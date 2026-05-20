/**
 * @insurtech/shared-ui -- Skalean InsurTech v2.2
 * Reference : task-1.4.8 Sprint 4 Phase 1
 */
export const VERSION = '0.1.0';

// Existing components
export { LocaleSwitcher } from './components/LocaleSwitcher.js';
export { ThemeToggle } from './components/theme-toggle.js';

// Theme provider
export { ThemeProvider } from './components/ThemeProvider.js';

// Lib utilities
export { cn } from './lib/cn.js';

// Hooks
export { useDirection, getDirectionFromLocale } from './hooks/useDirection.js';
export type { Direction } from './hooks/useDirection.js';
export { useTheme } from './hooks/useTheme.js';
export type { Theme, UseThemeResult } from './hooks/useTheme.js';

// UI components -- Action
export { Button } from './components/ui/button.js';
export type { ButtonVariant, ButtonSize } from './components/ui/button.js';
export { IconButton } from './components/ui/icon-button.js';
export { ButtonGroup } from './components/ui/button-group.js';
export { DropdownMenu } from './components/ui/dropdown-menu.js';

// UI components -- Form
export { Input } from './components/ui/input.js';
export { Textarea } from './components/ui/textarea.js';
export { Select } from './components/ui/select.js';
export { Combobox } from './components/ui/combobox.js';
export { DatePicker } from './components/ui/date-picker.js';
export { Checkbox } from './components/ui/checkbox.js';
export { RadioGroup } from './components/ui/radio-group.js';
export { Switch } from './components/ui/switch.js';
export { Slider } from './components/ui/slider.js';

// UI components -- Layout
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/ui/card.js';
export { Container } from './components/ui/container.js';
export { Stack } from './components/ui/stack.js';
export { Grid } from './components/ui/grid.js';

// UI components -- Feedback
export { Alert } from './components/ui/alert.js';
export type { AlertVariant } from './components/ui/alert.js';
export { toast, Toaster } from './components/ui/toast.js';
export { Dialog } from './components/ui/dialog.js';
export { AlertDialog } from './components/ui/alert-dialog.js';
export { Drawer } from './components/ui/drawer.js';
export { Skeleton } from './components/ui/skeleton.js';
export { Spinner } from './components/ui/spinner.js';
export { Progress } from './components/ui/progress.js';

// UI components -- Navigation
export { Tabs } from './components/ui/tabs.js';
export { Breadcrumb } from './components/ui/breadcrumb.js';
export { Pagination } from './components/ui/pagination.js';
export { Sidebar, SidebarHeader, SidebarNav, SidebarFooter } from './components/ui/sidebar.js';
export { NavLink } from './components/ui/nav-link.js';

// UI components -- Data Display
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/table.js';
export { DataTable } from './components/ui/data-table.js';
export { Badge } from './components/ui/badge.js';
export type { BadgeVariant } from './components/ui/badge.js';
export { Avatar } from './components/ui/avatar.js';
export { Tooltip } from './components/ui/tooltip.js';
export { Popover } from './components/ui/popover.js';

// i18n routing + navigation
export { routing, SUPPORTED_LOCALES, DEFAULT_LOCALE, RTL_LOCALES, isRtl, getDirection } from './i18n/routing';
export type { SupportedLocale, RtlLocale, Pathnames } from './i18n/routing';
export { LOCALES, getLocaleConfig, getLocaleFontStack } from './i18n/locales';
export type { LocaleConfig } from './i18n/locales';
export { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } from './i18n/navigation';
export type { AppRouter } from './i18n/navigation';
export type { AppName, MessageKey } from './i18n/types';

// i18n format helpers
export { formatDate, formatTime, formatRelativeTime, formatDateRange } from './lib/format-date';
export type { DateFormatStyle } from './lib/format-date';
export { formatNumber, formatCurrency, formatPercent, formatCompact, parseLocalizedNumber } from './lib/format-number';
export type { NumberFormatOptions } from './lib/format-number';
export { formatList, formatListAnd, formatListOr, formatListUnit } from './lib/format-list';
export type { ListType, ListStyle } from './lib/format-list';
export { getPluralCategory, pluralize, getPluralCategoriesForLocale } from './lib/pluralize';
export type { PluralCategory, PluralMessages } from './lib/pluralize';

// i18n components
export { DirectionProvider, useIsRtl } from './components/DirectionProvider';
