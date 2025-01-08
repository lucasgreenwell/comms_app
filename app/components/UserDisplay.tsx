import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface UserDisplayProps {
  user: {
    id: string;
    email: string;
    display_name?: string | null;
  };
  showPresence?: boolean;
  isOnline?: boolean;
  className?: string;
}

export default function UserDisplay({ 
  user, 
  showPresence = true, 
  isOnline = false,
  className = ''
}: UserDisplayProps) {
  const displayName = user.display_name || user.email;

  return (
    <div className={`flex items-center ${className}`}>
      <span className="truncate">{displayName}</span>
      {showPresence && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className={`ml-2 text-lg leading-none ${isOnline ? 'text-green-500' : 'text-gray-400'}`}>●</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isOnline ? 'Online' : 'Offline'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
} 