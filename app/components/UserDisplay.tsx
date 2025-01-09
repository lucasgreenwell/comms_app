import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getSupabase } from '../auth';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserDisplayProps {
  user: {
    id: string;
    email?: string;
    display_name?: string | null;
  };
  showPresence?: boolean;
  isOnline?: boolean;
  className?: string;
  sidebarColor?: string;
}

export default function UserDisplay({ 
  user, 
  showPresence = true, 
  isOnline = false,
  className = '',
  sidebarColor = 'rgb(59, 73, 223)' // default blue color
}: UserDisplayProps) {
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const displayName = user.display_name || user.email || 'Anonymous User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    const fetchProfilePic = async () => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('user_profiles')
        .select('profile_pic_url')
        .eq('id', user.id)
        .single();
      
      setProfilePicUrl(data?.profile_pic_url || null);
    };

    fetchProfilePic();
  }, [user.id]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Avatar className="h-8 w-8">
        <AvatarImage src={profilePicUrl || undefined} alt={displayName} />
        <AvatarFallback 
          className="bg-white"
          style={{ color: sidebarColor }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{displayName}</span>
      {showPresence && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className={`text-lg leading-none ${isOnline ? 'text-green-500' : 'text-gray-400'}`}>●</span>
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