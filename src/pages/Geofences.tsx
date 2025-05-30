import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import AuthCheck from "@/components/AuthCheck";
import Navbar from "@/components/Navbar";
import Map from "@/components/Map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Plus, Trash, Search, Map as MapIcon, Edit, Shield, Check, Info, Smartphone, Wifi } from "lucide-react";
import GeofenceAddressSearch from "@/components/geofences/GeofenceAddressSearch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import PolicyLocationSearch from '@/components/geofences/PolicyLocationSearch';
import DeviceSelector from '@/components/geofences/DeviceSelector';
import ProfileSelector from '@/components/geofences/ProfileSelector';
import { getLocationFromIp } from '@/lib/utils/ip-geolocation';
import profilePolicyService, { ZonePolicy, defaultPolicies } from "@/lib/services/profile-policy-service";
import { useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from 'uuid';

// Default empty geofences array
const defaultGeofences: Geofence[] = [];

// Define a DEFAULT_POLICY constant for the IP address section
const DEFAULT_POLICY = {
  id: "",
  name: "",
  description: "",
  isDefault: false,
  locations: [],
  ipRanges: [],
  devices: [],
  profiles: []
};

// Type for geofence objects
interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  zonePolicyId: string | null;
}

// Policy Card Component
interface PolicyCardProps {
  policy: ZonePolicy;
  geofences: Geofence[];
  onEditGeofence: (id: string) => void;
  onDeleteGeofence: (id: string) => void;
  onDeletePolicy: (id: string) => void;
  onEditPolicy: (policy: ZonePolicy) => void;
}

const PolicyCard: React.FC<PolicyCardProps> = ({ policy, geofences, onEditGeofence, onDeleteGeofence, onDeletePolicy, onEditPolicy }) => {
  // Find all geofences associated with this policy
  const policyGeofences = geofences.filter(geofence => geofence.zonePolicyId === policy.id);
  
  // Get total number of IP addresses and GPS locations
  const ipLocationsCount = policy.ipRanges?.length || 0;
  const gpsLocationsCount = policy.locations?.length || 0;
  const totalLocationsCount = ipLocationsCount + gpsLocationsCount;
  
  return (
    <Card className={policy.isDefault ? "border-primary h-full" : "h-full"}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-medium">{policy.name}</CardTitle>
            {policy.isDefault && (
              <Badge variant="outline" className="mt-1 text-xs border-primary text-primary">
                Default Policy
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {policy.profiles.length > 0 && (
              <Badge variant="outline" className="bg-primary/10 border-primary/10">
                {policy.profiles.length} profile{policy.profiles.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {policy.devices.length > 0 && (
              <Badge variant="outline" className="bg-secondary border-secondary/10">
                {policy.devices.length} device{policy.devices.length !== 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="secondary">
              {totalLocationsCount} location{totalLocationsCount !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        <CardDescription>{policy.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="pb-0">
        <Tabs defaultValue="locations" className="w-full">
          <TabsList className="grid w-full" style={{ 
            gridTemplateColumns: `repeat(${policy.profiles.length > 0 ? '3' : policy.devices.length > 0 ? '2' : '1'}, 1fr)` 
          }}>
            <TabsTrigger value="locations">
              <MapPin className="h-4 w-4 mr-2" />
              Locations ({totalLocationsCount})
            </TabsTrigger>
            
            {policy.devices.length > 0 && (
              <TabsTrigger value="devices">
                <Smartphone className="h-4 w-4 mr-2" />
                Devices ({policy.devices.length})
              </TabsTrigger>
            )}
            
            {policy.profiles.length > 0 && (
              <TabsTrigger value="profiles">
                <Shield className="h-4 w-4 mr-2" />
                Profiles ({policy.profiles.length})
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="locations" className="pt-4">
            <div className="space-y-4">
              {/* Show IP-based locations first */}
              {policy.ipRanges && policy.ipRanges.length > 0 && policy.ipRanges.map((ipRange, index) => {
                // Try to get geographic location for this IP (for display purposes)
                const ipLocation = getLocationFromIp(ipRange.ipAddress);
                
                return (
                  <div key={`ip-${index}`} className="border rounded-lg overflow-hidden bg-secondary/5">
                    <div className="flex flex-col md:flex-row">
                      <div className="p-4 flex-1 md:w-1/2">
                        <div className="flex items-center gap-2 mb-2">
                          <Wifi className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">
                            IP Network {index + 1}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          <p>{ipRange.displayName}</p>
                          <p className="text-blue-600 font-mono text-xs">
                            {ipRange.ipAddress}
                          </p>
                          {ipLocation && (
                            <p className="text-muted-foreground text-xs">
                              Approximate Location: {ipLocation.latitude ? ipLocation.latitude.toFixed(6) : 'unknown'}, {ipLocation.longitude ? ipLocation.longitude.toFixed(6) : 'unknown'}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {ipLocation && ipLocation.latitude && ipLocation.longitude && (
                        <div className="md:w-1/2 h-[180px] md:h-auto">
                          <Map
                            geofences={[{
                              id: ipRange.geofenceId,
                              name: ipRange.displayName,
                              latitude: ipLocation.latitude,
                              longitude: ipLocation.longitude,
                              radius: ipLocation.accuracy || 100,
                              profileId: null,
                              zonePolicyId: policy.id,
                              color: "#2563eb", // Blue for IP-based locations
                              borderColor: "#1e40af"
                            }]}
                            center={[ipLocation.longitude, ipLocation.latitude]}
                            zoom={13}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Then show GPS-based locations if any */}
              {policy.locations.map((location, index) => (
                <div key={`gps-${index}`} className="border rounded-lg overflow-hidden bg-secondary/5">
                  <div className="flex flex-col md:flex-row">
                    <div className="p-4 flex-1 md:w-1/2">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          GPS Location {policy.locations.length > 1 ? index + 1 : ''}
                        </span>
                        {policy.isDefault && index === 0 && (
                          <Badge variant="outline" className="text-xs">
                            Fallback Policy
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <p>{location.displayName}</p>
                        <p className="text-muted-foreground">
                          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </p>
                        <p className="text-muted-foreground">
                          Radius: {location.radius}m
                        </p>
                      </div>
                    </div>
                    
                    <div className="md:w-1/2 h-[180px] md:h-auto">
                      <Map
                        geofences={[{
                          id: location.geofenceId,
                          name: location.displayName,
                          latitude: location.latitude,
                          longitude: location.longitude,
                          radius: location.radius,
                          profileId: null,
                          zonePolicyId: null
                        }]}
                        center={[location.longitude, location.latitude]}
                        zoom={13}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {totalLocationsCount === 0 && (
                <div className="border border-dashed rounded-md p-6 flex flex-col items-center justify-center text-muted-foreground">
                  <MapPin className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm text-center mb-1">No locations defined</p>
                  <p className="text-xs text-center">
                    Edit this policy to add IP addresses or GPS locations
                  </p>
                </div>
              )}
              
              {policy.isDefault && (
                <p className="text-xs text-muted-foreground italic">
                  This policy will apply when a device is outside all other defined locations.
                </p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="devices" className="pt-4">
            <div className="space-y-4">
              {policy.devices.map((device, deviceIndex) => (
                deviceIndex < 2 && (
                  <div key={device.id} className="border rounded-lg overflow-hidden bg-secondary/5">
                    <div className="flex flex-col p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {device.name}
                        </span>
                        {deviceIndex === 0 && (
                          <Badge variant="outline" className="ml-auto text-xs border-green-500 text-green-600">
                            Online
                          </Badge>
                        )}
                        {deviceIndex === 1 && (
                          <Badge variant="outline" className="ml-auto text-xs border-orange-500 text-orange-600">
                            Last seen 4 days ago
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                        <div className="space-y-2">
                          <div>
                            <p className="text-muted-foreground text-xs">Model</p>
                            <p className="font-medium">
                              {deviceIndex === 0 ? "iPhone 13 mini" : "iPad Pro (11-inch)"}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground text-xs">OS Version</p>
                            <p>
                              {deviceIndex === 0 ? "iOS 18.3.2" : "iOS 18.3"}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground text-xs">Policy Status</p>
                            <p className="flex items-center">
                              <span className={`px-2 py-1 rounded-full text-xs ${policy.isDefault ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"}`}>
                                {policy.isDefault ? "Default Policy" : "Location-based Policy"}
                              </span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <p className="text-muted-foreground text-xs">Status</p>
                            <p>
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Supervised
                              </span>
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground text-xs">Battery</p>
                            <div className="flex items-center gap-2">
                              {deviceIndex === 0 ? (
                                <>
                                  <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: "33%" }}></div>
                                  </div>
                                  <span>33%</span>
                                </>
                              ) : (
                                <>
                                  <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 rounded-full" style={{ width: "1%" }}></div>
                                  </div>
                                  <span className="text-red-500">1%</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground text-xs">Storage</p>
                            <p>
                              {deviceIndex === 0 ? "42.9 GB free of 128 GB" : "60.4 GB free of 128 GB"}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {deviceIndex === 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Phone Number</p>
                              <p>+1 (956) 329-4317</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Carrier</p>
                              <p>Visible</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Location info for the first device with coordinates */}
                      {deviceIndex === 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Last Known Location</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              Updated 1 day ago
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            26.30169°, -98.18092° (Accuracy: 26m)
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Policy Assignment: </span>
                            Based on current location
                          </div>
                        </div>
                      )}
                      
                      {/* For iPad without location - add policy assignment info */}
                      {deviceIndex === 1 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Device Location</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            No location data available
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Policy Assignment: </span>
                            {policy.isDefault ? "Using default policy (no location data)" : "Manually assigned to this policy"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
              
              {policy.devices.length > 2 && (
                <div className="border rounded-lg overflow-hidden bg-secondary/5">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        Additional Devices
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {policy.devices.slice(2).map(device => (
                        <div 
                          key={device.id}
                          className="bg-secondary text-secondary-foreground rounded-md px-3 py-2.5 text-sm flex items-center gap-1.5"
                        >
                          <Smartphone className="h-4 w-4" />
                          <span>{device.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {policy.devices.length === 0 && (
                <div className="border rounded-lg overflow-hidden bg-secondary/5">
                  <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground p-4">
                    <Smartphone className="h-12 w-12 mb-2 opacity-20" />
                    <p>No devices assigned to this policy</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="profiles" className="pt-4">
            <div className="space-y-4">
              {policy.profiles.map((profile, profileIndex) => (
                profileIndex < 2 && (
                  <div key={profile.id} className="border rounded-lg overflow-hidden bg-secondary/5">
                    <div className="flex flex-col p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {profile.name}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {profileIndex === 0 ? "Configuration" : "Restriction"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-4 text-sm mt-2">
                        <div className="space-y-2">
                          <div>
                            <p className="text-muted-foreground text-xs">Profile Type</p>
                            <p className="font-medium">
                              {profileIndex === 0 ? "WiFi Configuration" : "App Restrictions"}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground text-xs">Description</p>
                            <p>
                              {profileIndex === 0 
                                ? "Automatically connects to corporate WiFi networks" 
                                : "Restricts access to certain applications when in this location"}
                            </p>
                          </div>
                          
                          <div className="pt-2">
                            <p className="text-muted-foreground text-xs">Settings</p>
                            <div className="mt-2 grid grid-cols-1 gap-2">
                              {profileIndex === 0 ? (
                                <>
                                  <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                                    <span>SSID</span>
                                    <span className="font-medium">Corporate-{policy.name.split(' ')[0]}</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                                    <span>Security Type</span>
                                    <span className="font-medium">WPA2 Enterprise</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                                    <span>Auto-Join</span>
                                    <span className="font-medium">Enabled</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                                    <span>Social Media Apps</span>
                                    <span className="font-medium text-red-500">Blocked</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                                    <span>Camera Access</span>
                                    <span className="font-medium text-amber-500">Limited</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                                    <span>Corporate Apps</span>
                                    <span className="font-medium text-green-500">Allowed</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ))}
              
              {policy.profiles.length > 2 && (
                <div className="border rounded-lg overflow-hidden bg-secondary/5">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        Additional Profiles
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {policy.profiles.slice(2).map(profile => (
                        <div 
                          key={profile.id}
                          className="bg-primary/10 text-primary rounded-md px-3 py-2.5 text-sm flex items-center gap-1.5"
                        >
                          <Shield className="h-4 w-4" />
                          <span>{profile.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {policy.profiles.length === 0 && (
                <div className="border rounded-lg overflow-hidden bg-secondary/5">
                  <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground p-4">
                    <Shield className="h-12 w-12 mb-2 opacity-20" />
                    <p>No profiles assigned to this policy</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex gap-2 mt-4">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => onEditPolicy(policy)}
        >
          <Shield className="h-4 w-4 mr-2" />
          Edit Policy Settings
        </Button>
        {!policy.isDefault ? (
          <Button 
            variant="destructive" 
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeletePolicy(policy.id);
            }}
          >
            <Trash className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            variant="ghost" 
            size="icon"
            disabled
            className="opacity-50 cursor-not-allowed"
            title="Default policy cannot be deleted"
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

const Geofences = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States for the component
  const [policies, setPolicies] = useState<ZonePolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<ZonePolicy | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isAddingIpRange, setIsAddingIpRange] = useState(false);
  const [newIpRange, setNewIpRange] = useState({ displayName: '', ipAddress: '', geofenceId: '' });
  const [geofences, setGeofences] = useState<Geofence[]>(defaultGeofences);
  const [selectedGeofence, setSelectedGeofence] = useState<string | null>(null);
  const [isAddingGeofence, setIsAddingGeofence] = useState(false);
  const [newGeofenceCoords, setNewGeofenceCoords] = useState<{lat: number, lng: number} | null>(null);
  const [newGeofenceName, setNewGeofenceName] = useState("");
  const [newGeofenceRadius, setNewGeofenceRadius] = useState("100");
  const [newGeofenceZonePolicy, setNewGeofenceZonePolicy] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [geofenceCreationMethod, setGeofenceCreationMethod] = useState<"map" | "address">("map");
  const [locationDisplayName, setLocationDisplayName] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [isNewPolicyDialogOpen, setIsNewPolicyDialogOpen] = useState(false);
  const [isEditPolicyDialogOpen, setIsEditPolicyDialogOpen] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyDescription, setNewPolicyDescription] = useState('');
  const [newPolicyLocation, setNewPolicyLocation] = useState<{
    displayName: string;
    latitude: number;
    longitude: number;
    radius: number;
  } | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<ZonePolicy | null>(null);
  const [selectedGeofenceForPolicy, setSelectedGeofenceForPolicy] = useState<string | null>(null);
  const [newPolicyDevices, setNewPolicyDevices] = useState<{
    id: string;
    name: string;
  }[]>([]);
  const [newPolicyProfiles, setNewPolicyProfiles] = useState<{
    id: string;
    name: string;
  }[]>([]);

  // Load policies from Supabase on component mount
  useEffect(() => {
    loadPolicies();
  }, []);

  // Function to load policies from the service
  const loadPolicies = async () => {
    try {
      const loadedPolicies = await profilePolicyService.getPolicies();
      setPolicies(loadedPolicies);
      
      // Select the first policy by default if none is selected
      if (!selectedPolicy && loadedPolicies.length > 0) {
        setSelectedPolicy(loadedPolicies[0]);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load policies',
        variant: 'destructive',
      });
    }
  };

  // Function to save policies to Supabase
  const savePolicies = async (updatedPolicies: ZonePolicy[]) => {
    try {
      // For each policy, either update if it exists or create if it's new
      for (const policy of updatedPolicies) {
        const existingPolicy = await profilePolicyService.getPolicyById(policy.id);
        if (existingPolicy) {
          await profilePolicyService.updatePolicy(policy);
        } else {
          await profilePolicyService.createPolicy(policy);
        }
      }
      
      // Handle any deleted policies
      for (const oldPolicy of policies) {
        if (!updatedPolicies.some(p => p.id === oldPolicy.id)) {
          await profilePolicyService.deletePolicy(oldPolicy.id);
        }
      }
      
      setPolicies(updatedPolicies);
      
      // Invalidate relevant query cache to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      
    } catch (error) {
      console.error('Error saving policies:', error);
      toast({
        title: 'Error',
        description: 'Failed to save policies',
        variant: 'destructive',
      });
    }
  };

  // Function to add a new policy
  const addNewPolicy = async () => {
    const newPolicy: Omit<ZonePolicy, 'id'> = {
      name: 'New Policy',
      description: 'Description of the new policy',
      isDefault: false,
      locations: [],
      ipRanges: [],
      devices: [],
      profiles: []
    };
    
    try {
      const createdPolicy = await profilePolicyService.createPolicy(newPolicy);
      const updatedPolicies = [...policies, createdPolicy];
      setPolicies(updatedPolicies);
      setSelectedPolicy(createdPolicy);
      setEditMode(true);
      
      toast({
        title: 'Success',
        description: 'New policy created',
      });
    } catch (error) {
      console.error('Error creating policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new policy',
        variant: 'destructive',
      });
    }
  };

  // Function to update the selected policy
  const updateSelectedPolicy = async (updatedPolicy: ZonePolicy) => {
    try {
      await profilePolicyService.updatePolicy(updatedPolicy);
      
      const updatedPolicies = policies.map(p => 
        p.id === updatedPolicy.id ? updatedPolicy : p
      );
      
      setPolicies(updatedPolicies);
      setSelectedPolicy(updatedPolicy);
      
      toast({
        title: 'Success',
        description: 'Policy updated successfully',
      });
    } catch (error) {
      console.error('Error updating policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to update policy',
        variant: 'destructive',
      });
    }
  };

  // Function to delete the selected policy
  const deleteSelectedPolicy = async () => {
    if (!selectedPolicy) return;
    
    // Don't allow deleting the default policy
    if (selectedPolicy.isDefault) {
      toast({
        title: 'Error',
        description: 'Cannot delete the default policy',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await profilePolicyService.deletePolicy(selectedPolicy.id);
      
      const updatedPolicies = policies.filter(p => p.id !== selectedPolicy.id);
      setPolicies(updatedPolicies);
      
      // Select another policy if available
      if (updatedPolicies.length > 0) {
        setSelectedPolicy(updatedPolicies[0]);
      } else {
        setSelectedPolicy(null);
      }
      
      toast({
        title: 'Success',
        description: 'Policy deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete policy',
        variant: 'destructive',
      });
    }
  };

  // Handle IP range additions
  const handleAddIpRange = () => {
    if (!selectedPolicy) return;
    
    if (!newIpRange.displayName || !newIpRange.ipAddress) {
      toast({
        title: 'Error',
        description: 'Please provide both a name and IP range',
        variant: 'destructive',
      });
      return;
    }
    
    const updatedIpRanges = [
      ...(selectedPolicy.ipRanges || []),
      {
        ...newIpRange,
        geofenceId: uuidv4()
      }
    ];
    
    const updatedPolicy = {
      ...selectedPolicy,
      ipRanges: updatedIpRanges
    };
    
    updateSelectedPolicy(updatedPolicy);
    setNewIpRange({ displayName: '', ipAddress: '', geofenceId: '' });
    setIsAddingIpRange(false);
  };

  // Handle IP range deletions
  const handleDeleteIpRange = (geofenceId: string) => {
    if (!selectedPolicy || !selectedPolicy.ipRanges) return;
    
    const updatedIpRanges = selectedPolicy.ipRanges.filter(
      range => range.geofenceId !== geofenceId
    );
    
    const updatedPolicy = {
      ...selectedPolicy,
      ipRanges: updatedIpRanges
    };
    
    updateSelectedPolicy(updatedPolicy);
  };

  // Other handler functions for locations, devices, profiles, etc.
  // ... existing code ...

  const handleAddGeofence = (lat: number, lng: number) => {
    setNewGeofenceCoords({ lat, lng });
    setDialogMode("create");
    setIsDialogOpen(true);
    setIsAddingGeofence(false);
  };

  const handleAddressSelect = (lat: number, lng: number, displayName: string) => {
    setNewGeofenceCoords({ lat, lng });
    setLocationDisplayName(displayName);
    
    // Auto-populate the name field with the location name if empty
    if (!newGeofenceName && dialogMode === "create") {
      // Extract just the main part of the address (before the first comma)
      const simplifiedName = displayName.split(',')[0];
      setNewGeofenceName(simplifiedName);
    }
  };

  const handleSaveGeofence = () => {
    if (!newGeofenceName || !newGeofenceCoords) return;
    
    if (dialogMode === "create") {
      // Create new geofence with UUID
      const newGeofence = {
        id: uuidv4(), // Use UUID instead of timestamp
        name: newGeofenceName,
        latitude: newGeofenceCoords.lat,
        longitude: newGeofenceCoords.lng,
        radius: parseInt(newGeofenceRadius),
        zonePolicyId: newGeofenceZonePolicy === "none" ? null : newGeofenceZonePolicy,
      };
      
      const updatedGeofences = [...geofences, newGeofence];
      setGeofences(updatedGeofences);
      
      toast({
        title: "Geofence Added",
        description: `"${newGeofenceName}" has been created successfully.`,
      });
    } else if (dialogMode === "edit" && editingGeofenceId) {
      // Update existing geofence
      const updatedGeofences = geofences.map(geofence => {
        if (geofence.id === editingGeofenceId) {
          return {
            ...geofence,
            name: newGeofenceName,
            radius: parseInt(newGeofenceRadius),
            zonePolicyId: newGeofenceZonePolicy === "none" ? null : newGeofenceZonePolicy,
            // Keep the original location if we didn't change it
            latitude: newGeofenceCoords.lat,
            longitude: newGeofenceCoords.lng,
          };
        }
        return geofence;
      });
      
      setGeofences(updatedGeofences);
      
      toast({
        title: "Geofence Updated",
        description: `"${newGeofenceName}" has been updated successfully.`,
      });
    }
    
    // Reset form
    setNewGeofenceName("");
    setNewGeofenceRadius("100");
    setNewGeofenceZonePolicy(null);
    setNewGeofenceCoords(null);
    setLocationDisplayName(null);
    setEditingGeofenceId(null);
    setIsDialogOpen(false);
  };

  const handleUpdatePolicy = () => {
    if (!editingPolicy) return;
    
    // Validate location for non-default policies if they have a GPS location
    // Don't try to validate locations if the policy only uses IP addresses
    if (!editingPolicy.isDefault && editingPolicy.locations && editingPolicy.locations.length > 0) {
      const { latitude, longitude, displayName, radius } = editingPolicy.locations[0];
      
      if (!displayName.trim()) {
        toast({
          title: "Location Name Required",
          description: "Please enter a name for this location",
          variant: "destructive"
        });
        return;
      }
      
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        toast({
          title: "Invalid Latitude",
          description: "Latitude must be between -90 and 90 degrees",
          variant: "destructive"
        });
        return;
      }
      
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        toast({
          title: "Invalid Longitude",
          description: "Longitude must be between -180 and 180 degrees",
          variant: "destructive"
        });
        return;
      }
      
      if (isNaN(radius) || radius < 1) {
        toast({
          title: "Invalid Radius",
          description: "Radius must be at least 1 meter",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Ensure the policy has at least a location or IP range (unless it's a default policy)
    if (!editingPolicy.isDefault && 
        (!editingPolicy.locations || editingPolicy.locations.length === 0) && 
        (!editingPolicy.ipRanges || editingPolicy.ipRanges.length === 0)) {
      toast({
        title: "Missing Location Information",
        description: "Please add at least one GPS location or IP address to the policy",
        variant: "destructive"
      });
      return;
    }
    
    const updatedPolicies = policies.map(p => 
      p.id === editingPolicy.id ? editingPolicy : p
    );
    
    setPolicies(updatedPolicies);
    savePolicies(updatedPolicies);
    setIsEditPolicyDialogOpen(false);
    
    toast({
      title: "Policy Updated",
      description: `"${editingPolicy.name}" has been updated successfully.`,
    });
  };

  const handleDeletePolicy = (id: string) => {
    const policyToDelete = policies.find(p => p.id === id);
    if (!policyToDelete) return;

    // Double-check we're not deleting the default policy
    if (policyToDelete.isDefault) {
      toast({
        title: "Cannot Delete Default Policy",
        description: "The default policy cannot be deleted as it serves as a fallback.",
        variant: "destructive"
      });
      return;
    }


    // Debug log to confirm the function is being called
    console.log('Attempting to delete policy:', id);
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this policy? Any associated geofences will be unlinked.')) {
      return;
    }

    // Update policies state
    const updatedPolicies = policies.filter(p => p.id !== id);
    setPolicies(updatedPolicies);
    savePolicies(updatedPolicies);
    
    // Update any geofences using this policy
    const updatedGeofences = geofences.map(g => {
      if (g.zonePolicyId === id) {
        return { ...g, zonePolicyId: null };
      }
      return g;
    });
    setGeofences(updatedGeofences);
    
    toast({
      title: "Policy Deleted",
      description: "The policy has been removed and any associated geofences have been unlinked.",
    });
  };

  const handleEditPolicy = (policy: ZonePolicy) => {
    setEditingPolicy(policy);
    setIsEditPolicyDialogOpen(true);
  };

  // Update the handleCreatePolicy function to handle multiple locations and devices
  const handleCreatePolicy = () => {
    if (!newPolicyName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a policy name",
        variant: "destructive"
      });
      return;
    }
  
    // Create basic policy structure with a valid UUID
    const newPolicy: ZonePolicy = {
      id: uuidv4(), // Use a proper UUID format instead of string timestamp
      name: newPolicyName,
      description: newPolicyDescription || "",
      isDefault: false,
      locations: [], // Default to empty locations array
      devices: newPolicyDevices, // Include the selected devices
      profiles: newPolicyProfiles // Include the selected profiles
    };

    // Add GPS location if provided
    if (newPolicyLocation) {
      newPolicy.locations = [
        {
          ...newPolicyLocation,
          geofenceId: uuidv4() // Use a proper UUID format
        }
      ];
    }
    
    // Add IP addresses if provided (coming from the form inputs)
    const ipAddressInput = document.querySelector('input[placeholder="IP Address (e.g., 192.168.1.1)"]') as HTMLInputElement;
    const locationNameInput = document.querySelector('input[placeholder="Location Name (e.g., Main Office)"]') as HTMLInputElement;
    
    if (ipAddressInput && ipAddressInput.value.trim()) {
      // Initialize ipRanges if needed
      if (!newPolicy.ipRanges) {
        newPolicy.ipRanges = [];
      }
      
      newPolicy.ipRanges.push({
        displayName: locationNameInput?.value.trim() || "Office Network",
        ipAddress: ipAddressInput.value.trim(),
        geofenceId: uuidv4() // Use a proper UUID format
      });
    }
    
    // Check if we have either GPS location or IP addresses
    if (newPolicy.locations.length === 0 && (!newPolicy.ipRanges || newPolicy.ipRanges.length === 0)) {
      toast({
        title: "Missing Information",
        description: "Please add at least one location (GPS or IP address)",
        variant: "destructive"
      });
      return;
    }
    
    const updatedPolicies = [...policies, newPolicy];
    setPolicies(updatedPolicies);
    savePolicies(updatedPolicies);
    
    setNewPolicyName('');
    setNewPolicyDescription('');
    setNewPolicyLocation(null);
    setNewPolicyDevices([]); // Reset selected devices
    setNewPolicyProfiles([]); // Reset selected profiles
    setIsNewPolicyDialogOpen(false);
    
    toast({
      title: "Policy Created",
      description: `"${newPolicyName}" has been created successfully.`,
    });
  };

  const handleDeleteGeofence = (id: string) => {
    const updatedGeofences = geofences.filter(g => g.id !== id);
    setGeofences(updatedGeofences);
    
    if (selectedGeofence === id) {
      setSelectedGeofence(null);
    }
    
    toast({
      title: "Geofence Deleted",
      description: "The geofence has been removed.",
    });
  };

  const handleOpenDialog = () => {
    setDialogMode("create");
    setNewGeofenceName("");
    setNewGeofenceRadius("100");
    setNewGeofenceZonePolicy(null);
    setLocationDisplayName(null);
    setGeofenceCreationMethod("map");
    setEditingGeofenceId(null);
    setIsDialogOpen(true);
  };

  const handleEditGeofence = (id: string) => {
    const geofenceToEdit = geofences.find(g => g.id === id);
    if (!geofenceToEdit) return;

    setDialogMode("edit");
    setEditingGeofenceId(id);
    setNewGeofenceName(geofenceToEdit.name);
    setNewGeofenceRadius(geofenceToEdit.radius.toString());
    setNewGeofenceZonePolicy(geofenceToEdit.zonePolicyId || "none");
    setNewGeofenceCoords({ lat: geofenceToEdit.latitude, lng: geofenceToEdit.longitude });
    setGeofenceCreationMethod("map"); // Default to map view when editing
    setIsDialogOpen(true);
  };

  return (
    <AuthCheck>
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        
        <main className="flex-1 container mx-auto p-4 md:p-6">
          {/* Page title and action buttons - always visible */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
            <h1 className="text-2xl font-bold">Location Policies</h1>
            <div className="flex gap-2">
              <Button onClick={() => setIsNewPolicyDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Policy
              </Button>
            </div>
          </div>
          
          {/* Policies view */}
          <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Policy cards with associated locations */}
                  {policies.map(policy => (
                    <PolicyCard 
                      key={policy.id}
                      policy={policy}
                      geofences={geofences.map(g => ({
                        ...g,
                        profileId: null // Add required profileId property
                      }))}
                      onEditGeofence={handleEditGeofence}
                      onDeleteGeofence={handleDeleteGeofence}
                      onDeletePolicy={handleDeletePolicy}
                      onEditPolicy={handleEditPolicy}
                    />
                  ))}
                </div>
          </div>
          
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Create New Geofence" : "Edit Geofence"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "create" 
                ? "Define a geofence by searching for an address or selecting a location on the map" 
                : "Modify this geofence's properties"
              }
            </DialogDescription>
          </DialogHeader>
          
          <Tabs 
            value={geofenceCreationMethod} 
            onValueChange={(value) => setGeofenceCreationMethod(value as "map" | "address")}
            className="pt-2"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="map">
                <MapIcon className="h-4 w-4 mr-2" />
                Map Selection
              </TabsTrigger>
              <TabsTrigger value="address" disabled={dialogMode === "edit"}>
                <Search className="h-4 w-4 mr-2" />
                Address Search
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="map" className="space-y-4">
              {!newGeofenceCoords && dialogMode === "create" && (
                <div className="p-4 text-center border rounded-md bg-muted/30">
                  <p className="text-muted-foreground">
                    Close this dialog and click "Click on Map" to select a location on the map.
                  </p>
                </div>
              )}
              
              {newGeofenceCoords && (
                <div className="space-y-2">
                  <Label>Selected Location</Label>
                  <div className="p-3 bg-secondary/30 rounded-lg text-sm">
                    <div className="space-y-1">
                      <div>Latitude: {newGeofenceCoords.lat.toFixed(6)}</div>
                      <div>Longitude: {newGeofenceCoords.lng.toFixed(6)}</div>
                      {locationDisplayName && (
                        <div className="pt-2 text-xs text-muted-foreground">
                          {locationDisplayName}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="address" className="space-y-4">
              <GeofenceAddressSearch 
                onSelectLocation={handleAddressSelect}
              />
              
              {newGeofenceCoords && locationDisplayName && (
                <div className="p-3 border rounded-md bg-muted/30">
                  <p className="font-medium text-sm">Selected Location:</p>
                  <p className="text-sm text-muted-foreground">{locationDisplayName}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="geofence-name">Name</Label>
              <Input 
                id="geofence-name" 
                placeholder="e.g., Office Building"
                value={newGeofenceName}
                onChange={(e) => setNewGeofenceName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="geofence-radius">Radius (meters)</Label>
              <Input 
                id="geofence-radius" 
                type="number"
                placeholder="100"
                value={newGeofenceRadius}
                onChange={(e) => setNewGeofenceRadius(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="geofence-zonePolicy">Linked Policy</Label>
              <Select 
                value={newGeofenceZonePolicy || "none"} 
                onValueChange={setNewGeofenceZonePolicy}
              >
                <SelectTrigger id="geofence-zonePolicy">
                  <SelectValue placeholder="Select a policy" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5} className="z-[9999]">
                  <SelectItem value="none">No policy</SelectItem>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveGeofence}
              disabled={!newGeofenceName || !newGeofenceCoords}
            >
              {dialogMode === "create" ? "Create Geofence" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewPolicyDialogOpen} onOpenChange={setIsNewPolicyDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Policy</DialogTitle>
            <DialogDescription>
              Define a new location policy with a custom location
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="policy-name">Policy Name</Label>
              <Input 
                id="policy-name" 
                placeholder="e.g., Social Media Policy"
                value={newPolicyName}
                onChange={(e) => setNewPolicyName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy-description">Description</Label>
              <Input 
                id="policy-description" 
                placeholder="e.g., Policy for the main office building"
                value={newPolicyDescription}
                onChange={(e) => setNewPolicyDescription(e.target.value)}
              />
            </div>

            <Separator className="my-4" />
            
            <Tabs defaultValue="locations" className="w-full mt-4">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="locations">
                  <MapPin className="h-4 w-4 mr-2" />
                  Locations
                </TabsTrigger>
                <TabsTrigger value="devices">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Devices
                </TabsTrigger>
                <TabsTrigger value="profiles">
                  <Shield className="h-4 w-4 mr-2" />
                  Profiles
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="locations" className="pt-4">
                {/* IP Address Configuration Section - Now the primary focus */}
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <Label>Device IP Addresses</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Initialize ipRanges if it doesn't exist
                        const newPolicy = {...DEFAULT_POLICY};
                        if (!newPolicy.ipRanges) {
                          newPolicy.ipRanges = [];
                        }
                        newPolicy.ipRanges.push({
                          displayName: `Office Network ${newPolicy.ipRanges.length + 1}`,
                          ipAddress: '',
                          geofenceId: uuidv4() // Use UUID instead of timestamp-based ID
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add IP Address
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Enter exact IP addresses for the device locations where this policy should apply.
                    </p>
                    
                    <div className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                      <Input
                        placeholder="Location Name (e.g., Main Office)"
                        onChange={(e) => {
                          // Update location display name
                        }}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="IP Address (e.g., 192.168.1.1)"
                          onChange={(e) => {
                            // Update IP address
                          }}
                        />
                        <Button 
                          variant="secondary" 
                          size="icon"
                          title="Get my current IP address"
                          onClick={() => {
                            // Get the current IP address
                            fetch('https://api.ipify.org?format=json')
                              .then(response => response.json())
                              .then(data => {
                                // Update the IP input field with the current IP
                                const ipField = document.querySelector('input[placeholder="IP Address (e.g., 192.168.1.1)"]') as HTMLInputElement;
                                if (ipField) {
                                  ipField.value = data.ip;
                                  // Trigger a change event to make sure state is updated
                                  const event = new Event('input', { bubbles: true });
                                  ipField.dispatchEvent(event);
                                }
                                
                                toast({
                                  title: "IP Address Detected",
                                  description: `Your current IP address is: ${data.ip}`,
                                });
                              })
                              .catch(error => {
                                console.error('Error fetching IP:', error);
                                toast({
                                  title: "Error Detecting IP",
                                  description: "Could not fetch your current IP address. Please try again or enter it manually.",
                                  variant: "destructive"
                                });
                              });
                          }}
                        >
                          <Wifi className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="devices" className="pt-4">
                <div className="space-y-4">
                  <DeviceSelector
                    selectedDevices={newPolicyDevices}
                    onSelectionChange={setNewPolicyDevices}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="profiles" className="pt-4">
                <div className="space-y-4">
                  <ProfileSelector
                    selectedProfiles={newPolicyProfiles}
                    onProfilesChange={setNewPolicyProfiles}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <DialogFooter className="sticky bottom-0 pt-4 bg-background mt-4">
            <Button variant="outline" onClick={() => setIsNewPolicyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePolicy}
              disabled={!newPolicyName.trim()}
            >
              Create Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Policy Dialog */}
      <Dialog open={isEditPolicyDialogOpen} onOpenChange={setIsEditPolicyDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Policy</DialogTitle>
            <DialogDescription>
              Update the policy name, description and location.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-policy-name">Policy Name</Label>
              <Input 
                id="edit-policy-name" 
                value={editingPolicy?.name || ''}
                onChange={(e) => setEditingPolicy(prev => 
                  prev ? {...prev, name: e.target.value} : null
                )}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-policy-desc">Description</Label>
              <Input 
                id="edit-policy-desc" 
                value={editingPolicy?.description || ''}
                onChange={(e) => setEditingPolicy(prev => 
                  prev ? {...prev, description: e.target.value} : null
                )}
              />
            </div>
            
            {editingPolicy && (
              <div className="space-y-4">
                <Separator className="my-4" />
                <div className="flex justify-between items-center">
                  <Label>Location Settings</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditingPolicy(prev => {
                        if (!prev) return null;
                        return {
                          ...prev,
                          locations: [
                            ...prev.locations,
                            {
                              displayName: "New Location",
                              latitude: 37.7749,
                              longitude: -122.4194,
                              radius: 100,
                              geofenceId: uuidv4() // Use UUID instead of timestamp
                            }
                          ]
                        };
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </div>
                
                {editingPolicy.isDefault && (
                  <div className="mb-3 p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Default Policy Location</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This policy serves as a fallback when devices are outside all other defined locations.
                    </p>
                  </div>
                )}
                
                <Tabs defaultValue="locations" className="w-full mt-4">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="locations">
                      <MapPin className="h-4 w-4 mr-2" />
                      Locations
                    </TabsTrigger>
                    <TabsTrigger value="devices">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Devices
                    </TabsTrigger>
                    <TabsTrigger value="profiles">
                      <Shield className="h-4 w-4 mr-2" />
                      Profiles
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="locations" className="pt-4">
                    {/* Only show IP-based location configuration */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label>Device IP Addresses</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingPolicy(prev => {
                              if (!prev) return null;
                              const currentIpRanges = prev.ipRanges || [];
                              return {
                                ...prev,
                                ipRanges: [
                                  ...currentIpRanges,
                                  {
                                    displayName: `Office Network ${currentIpRanges.length + 1}`,
                                    ipAddress: '',
                                    geofenceId: uuidv4() // Use UUID instead of timestamp-based ID
                                  }
                                ]
                              };
                            });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add IP Address
                        </Button>
                      </div>
                      
                      {(!editingPolicy.ipRanges || editingPolicy.ipRanges.length === 0) && (
                        <div className="border rounded-md p-6 flex flex-col items-center justify-center text-muted-foreground">
                          <p className="text-sm text-center mb-2">No IP addresses defined</p>
                          <p className="text-xs text-center max-w-md">
                            Add IP addresses to apply this policy to devices at specific locations. 
                            Enter the exact IP address of the network (e.g., 192.168.1.1).
                          </p>
                        </div>
                      )}
                      
                      {editingPolicy.ipRanges && editingPolicy.ipRanges.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Enter exact IP addresses for the device locations where this policy should apply.
                          </p>
                          
                          {editingPolicy.ipRanges.map((ipRange, idx) => (
                            <div key={ipRange.geofenceId} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                              <Input
                                placeholder="Location Name (e.g., Main Office)"
                                value={ipRange.displayName}
                                onChange={(e) => {
                                  setEditingPolicy(prev => {
                                    if (!prev || !prev.ipRanges) return prev;
                                    const newRanges = [...prev.ipRanges];
                                    newRanges[idx] = {...newRanges[idx], displayName: e.target.value};
                                    return {...prev, ipRanges: newRanges};
                                  });
                                }}
                              />
                              <div className="flex gap-2">
                                <Input
                                  placeholder="IP Address (e.g., 192.168.1.1)"
                                  value={ipRange.ipAddress}
                                  onChange={(e) => {
                                    setEditingPolicy(prev => {
                                      if (!prev || !prev.ipRanges) return prev;
                                      const newRanges = [...prev.ipRanges];
                                      newRanges[idx] = {...newRanges[idx], ipAddress: e.target.value};
                                      return {...prev, ipRanges: newRanges};
                                    });
                                  }}
                                />
                                <Button 
                                  variant="secondary" 
                                  size="icon"
                                  title="Get my current IP address"
                                  onClick={() => {
                                    // Get the current IP address
                                    fetch('https://api.ipify.org?format=json')
                                      .then(response => response.json())
                                      .then(data => {
                                        // Update the IP input field with the current IP
                                        const ipField = document.querySelector('input[placeholder="IP Address (e.g., 192.168.1.1)"]') as HTMLInputElement;
                                        if (ipField) {
                                          ipField.value = data.ip;
                                          // Trigger a change event to make sure state is updated
                                          const event = new Event('input', { bubbles: true });
                                          ipField.dispatchEvent(event);
                                        }
                                        
                                        toast({
                                          title: "IP Address Detected",
                                          description: `Your current IP address is: ${data.ip}`,
                                        });
                                      })
                                      .catch(error => {
                                        console.error('Error fetching IP:', error);
                                        toast({
                                          title: "Error Detecting IP",
                                          description: "Could not fetch your current IP address. Please try again or enter it manually.",
                                          variant: "destructive"
                                        });
                                      });
                                  }}
                                >
                                  <Wifi className="h-4 w-4" />
                                </Button>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setEditingPolicy(prev => {
                                    if (!prev || !prev.ipRanges) return prev;
                                    const newRanges = prev.ipRanges.filter((_, i) => i !== idx);
                                    return {...prev, ipRanges: newRanges};
                                  });
                                }}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="devices" className="pt-4">
                    <div className="space-y-4">
                      <DeviceSelector
                        selectedDevices={editingPolicy?.devices || []}
                        onSelectionChange={(devices) => 
                          setEditingPolicy(prev => 
                            prev ? {...prev, devices} : null
                          )
                        }
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="profiles" className="pt-4">
                    <div className="space-y-4">
                      <ProfileSelector
                        selectedProfiles={editingPolicy?.profiles || []}
                        onProfilesChange={(profiles) => 
                          setEditingPolicy(prev => 
                            prev ? {...prev, profiles} : null
                          )
                        }
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
          
          <DialogFooter className="sticky bottom-0 pt-4 bg-background mt-4">
            <Button variant="outline" onClick={() => setIsEditPolicyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdatePolicy}
              disabled={!editingPolicy?.name.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthCheck>
  );
};

export default Geofences;

// New Policy Dialog Component
const NewPolicyDialog = ({ 
  open, 
  onOpenChange, 
  onCreatePolicy, 
  geofences, 
  allDevices 
}: NewPolicyDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(1);
  const [isDefault, setIsDefault] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<{ id: string; name: string, latitude: number, longitude: number, radius: number }[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<{ id: string; name: string }[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<{ id: string; name: string }[]>([]);
  const [currentTab, setCurrentTab] = useState("general");
  
  const handleCreatePolicy = () => {
    onCreatePolicy({
      id: uuidv4(),
      name,
      description,
      isActive: true,
      isDefault,
      priority,
      locations: selectedLocations.map(location => ({
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
      })),
      devices: selectedDevices,
      profiles: selectedProfiles, // Include selected profiles in the policy
    });
    
    // Reset form fields
    setName("");
    setDescription("");
    setPriority(1);
    setIsDefault(false);
    setSelectedLocations([]);
    setSelectedDevices([]);
    setSelectedProfiles([]);
    setCurrentTab("general");
    
    // Close dialog
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create New Policy</DialogTitle>
          <DialogDescription>
            Define a new location-based policy for your mobile devices.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Policy Name</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Enter policy name"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Enter policy description"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority (1-10)</Label>
                <Input 
                  id="priority" 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={priority}
                  onChange={e => setPriority(parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  Higher priority policies are applied first when multiple policies match.
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="is-default" 
                  checked={isDefault}
                  onCheckedChange={(checked) => setIsDefault(!!checked)}
                />
                <Label htmlFor="is-default">Default Policy</Label>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                Default policies are applied when no other policies match a device's location.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="locations" className="space-y-4">
            <PolicyLocationSearch 
              geofences={geofences}
              selectedLocations={selectedLocations}
              onChange={setSelectedLocations}
              disabled={isDefault}
            />
            
            {isDefault && (
              <p className="text-sm text-amber-500">
                Default policies apply regardless of location and don't require location selection.
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="devices" className="space-y-4">
            <DeviceSelector
              availableDevices={allDevices}
              selectedDevices={selectedDevices}
              onDevicesChange={setSelectedDevices}
            />
          </TabsContent>
          
          <TabsContent value="profiles" className="space-y-4">
            <ProfileSelector
              selectedProfiles={selectedProfiles}
              onProfilesChange={setSelectedProfiles}
            />
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreatePolicy}
            disabled={!name.trim()}
          >
            Create Policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
