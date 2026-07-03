import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Pacific timezone utilities
export const getPacificTime = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
};

export const getPacificDate = (date?: Date) => {
  const d = date || new Date();
  const pacificTime = new Date(d.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return new Date(pacificTime.getFullYear(), pacificTime.getMonth(), pacificTime.getDate());
};

export const isPacificToday = (dateString: string) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const pacificDate = getPacificDate(date);
  const pacificToday = getPacificDate();
  
  return pacificDate.getTime() === pacificToday.getTime();
};

export const formatPacificTime = (date: Date) => {
  return date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatPacificDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};
