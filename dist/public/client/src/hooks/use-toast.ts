// Copied from shadcn/ui toast component (https://ui.shadcn.com/docs/components/toast)
import { Toast, toast } from "@/components/ui/toast";
import { useToast as useToastPrimitive } from "@/components/ui/toast";

export const useToast = useToastPrimitive;

export { toast, Toast };