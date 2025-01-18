'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '../auth'
import { useUser } from '../hooks/useUser'
import { Button } from '@/components/ui/button'
import { themes, Theme } from '../config/themes'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { User } from '@supabase/supabase-js'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import VoiceCloneSetup from '@/app/components/VoiceCloneSetup'
import { Switch } from "@/components/ui/switch"
import { Mail, User as UserIcon, Globe, Bot, Camera, Palette, Check, Mic, CheckCircle, RefreshCw, LogOut } from 'lucide-react'
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

const THEME_STORAGE_KEY = 'slack-clone-theme'

interface ExtendedUser extends User {
  display_name?: string | null;
  native_language?: string | null;
  eleven_labs_clone_id?: string | null;
  ai_assistant_enabled?: boolean;
}

interface Language {
  id: string;
  language: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const { user: currentUser } = useUser()
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'slate'
    }
    return 'slate'
  })
  const [formState, setFormState] = useState({
    displayName: '',
    language: '',
    aiAssistant: false
  })
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [languages, setLanguages] = useState<Language[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  const tourStep = parseInt(searchParams.get('tourStep') || '0')
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)

  useEffect(() => {
    fetchUser()
    fetchLanguages()
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme)
  }, [selectedTheme])

  useEffect(() => {
    if (user) {
      setFormState({
        displayName: user.display_name || '',
        language: user.native_language || '',
        aiAssistant: user.ai_assistant_enabled || false
      })
    }
  }, [user])

  const fetchLanguages = async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('top_languages')
      .select('*')
      .order('language')
    
    if (error) {
      console.error('Error fetching languages:', error)
      return
    }
    
    setLanguages(data)
  }

  const fetchUser = async () => {
    try {
      if (!currentUser) return;

      const supabase = getSupabase()
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (userError) throw userError

      const extendedUser: ExtendedUser = {
        ...currentUser,
        display_name: userData.display_name,
        native_language: userData.native_language
      }

      setUser(extendedUser)
      setFormState({
        displayName: userData.display_name || '',
        language: userData.native_language || '',
        aiAssistant: userData.ai_assistant_enabled || false
      })
      
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('profile_pic_url')
          .eq('id', currentUser.id)
          .maybeSingle()
        
        setProfilePicUrl(data?.profile_pic_url || null)
      } catch (error) {
        // Silently handle the error - profile pic not found is an expected case
        setProfilePicUrl(null)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      toast.error('Failed to load user data')
    }
  }

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentUser = user
    if (!currentUser?.id) return

    try {
      if (!e.target.files || !e.target.files[0]) return;

      const file = e.target.files[0]
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file')
        return
      }

      setUploading(true)
      const supabase = getSupabase()
      
      // Upload the file
      const fileExt = file.name.split('.').pop()
      const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('profile-pics')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get the public URL using the newer method
      const {
        data: { publicUrl },
      } = supabase.storage
        .from('profile-pics')
        .getPublicUrl(filePath)

      // Update the profile with the public URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: currentUser.id,
          profile_pic_url: publicUrl
        })

      if (updateError) throw updateError

      setProfilePicUrl(publicUrl)
      toast.success('Profile picture updated successfully!')
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      toast.error('Failed to update profile picture')
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId)
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('users')
        .update({
          display_name: formState.displayName,
          native_language: formState.language,
          ai_assistant_enabled: formState.aiAssistant
        })
        .eq('id', user.id)

      if (error) throw error

      await fetchUser()
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    }
  }

  const handleVoiceCreated = async (voiceId: string) => {
    await fetchUser() // Refresh user data to get the updated voice ID
    setIsVoiceModalOpen(false) // Close the modal after successful creation
  }

  if (!user) return <div>Loading...</div>

  const initials = ((user.display_name || user.email) || '')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Profile Settings</h1>
      
      <Card className="p-8">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg -z-10" />
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                <AvatarImage src={profilePicUrl || undefined} alt={formState.displayName} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full">
                <label htmlFor="profile-pic" className="cursor-pointer p-2 rounded-full hover:bg-white/20">
                  <Camera className="w-6 h-6 text-white" />
                </label>
                <Input
                  id="profile-pic"
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
                  User Information
                </h2>
                <p className="text-sm text-muted-foreground">Manage your profile information and preferences</p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Display Name
              </Label>
              <Input
                id="displayName"
                value={formState.displayName}
                onChange={(e) => setFormState(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Enter display name"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language" className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Preferred Language
              </Label>
              <Select 
                value={formState.language} 
                onValueChange={(value) => setFormState(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aiAssistant" className="text-sm font-medium flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI Assistant
              </Label>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center h-full pt-1">
                  <Switch
                    id="aiAssistant"
                    checked={formState.aiAssistant}
                    onCheckedChange={(checked) => setFormState(prev => ({ ...prev, aiAssistant: checked }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="aiAssistant">Have AI respond for you</Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, an AI assistant will respond to messages on your behalf.
                  </p>
                </div>
              </div>
            </div>

            {!user?.eleven_labs_clone_id && (
              <Dialog open={isVoiceModalOpen} onOpenChange={setIsVoiceModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Mic className="w-4 h-4 mr-2" />
                    Record Your Voice for the Assistant
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <VoiceCloneSetup
                    userId={user?.id}
                    userLanguage={formState.language || 'en'}
                    onVoiceCreated={handleVoiceCreated}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Button type="submit" className="w-full md:w-auto">
            Save Changes
          </Button>
        </form>
      </Card>

      <Card className="p-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Palette className="w-5 h-5 text-muted-foreground" />
              Sidebar Theme
            </h2>
            <p className="text-sm text-muted-foreground">Choose a theme that matches your style</p>
          </div>
          
          <RadioGroup
            value={selectedTheme}
            onValueChange={handleThemeChange}
            className="grid grid-cols-2 gap-4 md:grid-cols-3"
          >
            {themes.map((theme) => (
              <div key={theme.id} className="relative">
                <RadioGroupItem
                  value={theme.id}
                  id={theme.id}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={theme.id}
                  className={`
                    flex flex-col items-center justify-center rounded-lg
                    border-2 border-muted bg-card
                    hover:bg-accent hover:text-accent-foreground
                    peer-data-[state=checked]:border-primary
                    peer-data-[state=checked]:shadow-lg
                    cursor-pointer transition-all duration-300
                    overflow-hidden
                  `}
                >
                  <div className="w-full h-24 relative">
                    <div className={`absolute inset-0 ${theme.colors.background} ${theme.id === selectedTheme ? '' : 'opacity-50'}`} />
                    <div className="absolute inset-y-0 left-0 w-16 ${theme.colors.background}" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-medium ${theme.colors.foreground}`}>
                        {theme.name}
                      </span>
                    </div>
                  </div>
                  <div className="w-full p-2 flex justify-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${theme.colors.background}`} />
                    <div className={`w-3 h-3 rounded-full ${theme.colors.foreground}`} />
                  </div>
                </Label>
                <div className="absolute top-2 right-2 opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
      </Card>

      <Button onClick={handleLogout} variant="destructive" className="w-full md:w-auto">
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>
    </div>
  )
}

