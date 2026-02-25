import * as React from 'react';
import { BookOpen, Check, ChevronsUpDown, LogOut, User, Settings } from 'lucide-react';
import { ProfileSettings } from './ProfileSettings';
import { Preferences } from './Preferences';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { getInitials } from '../lib/utils';

const LANGUAGES = [
  { code: 'en-IN', name: 'English (English)' },
  { code: 'hi-IN', name: 'Hindi (हिंदी)' },
  { code: 'bn-IN', name: 'Bengali (বাংলা)' },
  { code: 'ta-IN', name: 'Tamil (தமிழ்)' },
  { code: 'te-IN', name: 'Telugu (తెలుగు)' },
  { code: 'kn-IN', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml-IN', name: 'Malayalam (മലയാളം)' },
  { code: 'mr-IN', name: 'Marathi (मराठी)' },
  { code: 'gu-IN', name: 'Gujarati (ગુજરાતી)' },
  { code: 'pa-IN', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'od-IN', name: 'Odia (ଓଡ଼ିଆ)' }
] as const;

export function ChatHeader({ language, setLanguage }: { language: string, setLanguage: (l: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [showProfile, setShowProfile] = React.useState(false);
  const [showPreferences, setShowPreferences] = React.useState(false);
  const { currentUser } = useAuth();
  let initials = 'U';
  if (currentUser?.displayName) {
    initials = getInitials(currentUser.displayName);
  } else if (currentUser?.email) {
    initials = currentUser.email.substring(0, 2).toUpperCase();
  }

  return (
    <div className="flex items-center gap-4 p-6 border-b border-slate-100 shrink-0 bg-white rounded-t-2xl">
      <div className="bg-blue-50 p-3 rounded-xl"><BookOpen className="w-7 h-7 text-blue-600" /></div>
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Samvidhan Agent</h1>
        <p className="text-slate-500 text-sm">Civic Rights & Issue Resolution</p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[200px] justify-between text-sm border-slate-200 bg-slate-50 font-normal hover:bg-slate-100 transition-all"
            >
              {language
                ? LANGUAGES.find((lang) => lang.code === language)?.name
                : "Select language..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 border-slate-200">
            <Command>
              <CommandInput placeholder="Search language..." className="h-9" />
              <CommandList className="custom-scrollbar">
                <CommandEmpty>No language found.</CommandEmpty>
                <CommandGroup>
                  {LANGUAGES.map((lang) => (
                    <CommandItem
                      key={lang.code}
                      value={lang.name}
                      onSelect={() => {
                        setLanguage(lang.code);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          language === lang.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {lang.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.email || "User avatar"} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Account</p>
                  <p className="text-xs leading-none text-slate-500">
                    {currentUser.email || currentUser.phoneNumber || 'User'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => setShowProfile(true)}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => setShowPreferences(true)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Preferences</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={() => auth.signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ProfileSettings open={showProfile} onOpenChange={setShowProfile} />
      <Preferences open={showPreferences} onOpenChange={setShowPreferences} />
    </div>
  );
}