import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Call } from "@shared/schema";
import placeholderImage from "@assets/cf7778a0-89b1-4538-a6a5-84f39862e1c5-Gallery_Reorder_1749315307820.jpg";

interface ScreenshotModalProps {
  call: Call;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScreenshotModal({ call, isOpen, onClose }: ScreenshotModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-lg font-semibold">
            Call Screenshot - {call.firstName} {call.lastName}
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Phone: {call.phone} | Date: {new Date(call.createdAt || '').toLocaleDateString()}
          </p>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <img 
              src={placeholderImage}
              alt="Call Screenshot"
              className="w-full h-auto rounded-lg shadow-lg"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}