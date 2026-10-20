import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { requestApi, donorApi, analyticsApi } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DashboardLayout } from '../components/DashboardLayout';
import { FulfillRequestModal } from '../components/FulfillRequestModal';
import { 
  Heart, 
  Search, 
  MapPin, 
  Clock,
  Package,
  TrendingUp,
  AlertTriangle,
  Filter,
  Building2,
  Leaf,
  Drumstick
} from 'lucide-react';
import { toast } from 'sonner';

export const DonorDashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [fulfillments, setFulfillments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    foodType: 'all',
    foodCategory: 'all',
    urgency: 'all',
  });
  const [userLocation, setUserLocation] = useState(null);
  const sharedRequestId = searchParams.get('request_id');

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (userLocation) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
      }
      
      const [reqRes, fulRes, anaRes] = await Promise.all([
        requestApi.getAll(params),
        donorApi.getFulfillments(),
        analyticsApi.getUser(),
      ]);
      
      setRequests(reqRes.data || []);
      setFulfillments(fulRes.data || []);
      setAnalytics(anaRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          console.log('Location permission denied');
        }
      );
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!sharedRequestId || loading || requests.length === 0) return;
    const sharedRequest = requests.find((request) => request.id === sharedRequestId);
    if (sharedRequest) {
      setSelectedRequest(sharedRequest);
      setSearchParams({}, { replace: true });
    }
  }, [sharedRequestId, loading, requests, setSearchParams]);

  const getUrgencyColor = (urgency) => {
    const colors = {
      critical: 'bg-destructive text-destructive-foreground',
      high: 'bg-accent text-accent-foreground',
      medium: 'bg-warning text-warning-foreground',
      low: 'bg-secondary text-secondary-foreground',
    };
    return colors[urgency] || colors.medium;
  };

  const getCategoryIcon = (category) => {
    if (category === 'veg') {
      return <Leaf className="h-3 w-3 text-green-600" />;
    } else if (category === 'non-veg') {
      return <Drumstick className="h-3 w-3 text-red-600" />;
    } else if (category === 'vegan') {
      return <Leaf className="h-3 w-3 text-emerald-600" />;
    }
    return null;
  };

  const filteredRequests = requests.filter(req => {
    if (filters.search && !req.ngo_name?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !req.address?.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.foodType !== 'all' && req.food_type !== filters.foodType) {
      return false;
    }
    if (filters.foodCategory !== 'all' && req.food_category !== filters.foodCategory) {
      return false;
    }
    if (filters.urgency !== 'all' && req.urgency_level !== filters.urgency) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="donor-dashboard">
        {/* Header */}
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
            Donor Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Browse and fulfill food requests from verified NGOs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-stone-200" data-testid="stat-donations">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-xl">
                  <Heart className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{analytics?.total_donations || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Donations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200" data-testid="stat-meals">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-xl">
                  <Package className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{analytics?.total_meals_donated || 0}</p>
                  <p className="text-sm text-muted-foreground">Meals Donated</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-stone-200">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by NGO or location..."
                  className="pl-10"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  data-testid="search-input"
                />
              </div>
              
              {/* Filter Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select 
                  value={filters.foodType} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, foodType: value }))}
                >
                  <SelectTrigger data-testid="food-type-filter">
                    <SelectValue placeholder="Food Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="cooked">Cooked</SelectItem>
                    <SelectItem value="packaged">Packaged</SelectItem>
                    <SelectItem value="raw">Raw</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="bio-waste foods">Bio-waste Foods</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select 
                  value={filters.foodCategory} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, foodCategory: value }))}
                >
                  <SelectTrigger data-testid="food-category-filter">
                    <SelectValue placeholder="Food Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="veg">
                      <span className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-green-600" />
                        Vegetarian
                      </span>
                    </SelectItem>
                    <SelectItem value="non-veg">
                      <span className="flex items-center gap-2">
                        <Drumstick className="h-4 w-4 text-red-600" />
                        Non-Vegetarian
                      </span>
                    </SelectItem>
                    <SelectItem value="vegan">
                      <span className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-emerald-600" />
                        Vegan
                      </span>
                    </SelectItem>
                    <SelectItem value="bio-waste foods">
                      <span className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-amber-600" />
                        Bio-waste Foods
                      </span>
                    </SelectItem>
                    <SelectItem value="mixed">Mixed (Veg & Non-Veg)</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select 
                  value={filters.urgency} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, urgency: value }))}
                >
                  <SelectTrigger data-testid="urgency-filter">
                    <SelectValue placeholder="Urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Urgency</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card className="border-stone-200">
          <CardHeader>
            <CardTitle className="font-heading">Available Requests</CardTitle>
            <CardDescription>
              {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} available
              {userLocation && ' • Sorted by distance'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No requests match your filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="p-4 rounded-xl border border-stone-200 hover:bg-secondary/30 smooth-transition"
                    data-testid={`request-${request.id}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">{request.ngo_name}</span>
                          <Badge className={getUrgencyColor(request.urgency_level)}>
                            {request.urgency_level === 'critical' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {request.urgency_level}
                          </Badge>
                          {request.food_category && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getCategoryIcon(request.food_category)}
                              <span className="capitalize">{request.food_category}</span>
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {request.food_type} • {request.quantity} servings
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {request.address}
                          </span>
                          {request.distance && (
                            <span className="flex items-center gap-1 text-primary font-medium">
                              {request.distance.toFixed(1)} km away
                            </span>
                          )}
                        </div>
                        {request.description && (
                          <p className="text-sm text-muted-foreground">{request.description}</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Needed: {request.quantity - request.fulfilled_quantity} more servings
                        </div>
                      </div>
                      <Button 
                        className="rounded-full"
                        onClick={() => setSelectedRequest(request)}
                        data-testid={`fulfill-btn-${request.id}`}
                      >
                        <Heart className="h-4 w-4 mr-2" />
                        Fulfill
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Fulfillments */}
        {fulfillments.length > 0 && (
          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle className="font-heading">My Fulfillments</CardTitle>
              <CardDescription>Track your donation contributions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fulfillments.map((fulfillment) => (
                  <div 
                    key={fulfillment.id} 
                    className="p-4 rounded-xl border border-stone-200"
                    data-testid={`fulfillment-${fulfillment.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{fulfillment.quantity} servings • {fulfillment.food_condition}</p>
                        <p className="text-sm text-muted-foreground">
                          Delivery: {fulfillment.delivery_method}
                        </p>
                        {fulfillment.volunteer_name && (
                          <p className="text-sm text-muted-foreground">
                            Volunteer: {fulfillment.volunteer_name}
                          </p>
                        )}
                      </div>
                      <Badge className={
                        fulfillment.status === 'confirmed' ? 'bg-success text-success-foreground' :
                        fulfillment.status === 'delivered' ? 'bg-primary text-primary-foreground' :
                        'bg-warning text-warning-foreground'
                      }>
                        {fulfillment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <FulfillRequestModal 
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        onSuccess={() => {
          fetchData();
          setSelectedRequest(null);
        }}
        userLocation={userLocation}
      />
    </DashboardLayout>
  );
};
