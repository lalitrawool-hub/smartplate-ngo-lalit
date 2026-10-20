import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Building2, Heart, Truck, ArrowRight, Check, Phone, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export const AuthPage = () => {
  const { login, verifyPhone, selectRole, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('login'); // login, phone, role
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const navigateToRole = (role) => {
    const returnTo = location.state?.returnTo;
    const safeReturnTo = role === 'donor'
      && typeof returnTo === 'string'
      && /^\/donor\?request_id=[\w-]+$/.test(returnTo)
      ? returnTo
      : `/${role}`;
    navigate(safeReturnTo);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const result = await login(credentialResponse.credential);
      toast.success('Signed in successfully!');
      
      if (result.user.phone_verified && result.user.role) {
        navigateToRole(result.user.role);
      } else if (result.user.phone_verified) {
        setStep('role');
      } else {
        setStep('phone');
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = () => {
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    setOtpSent(true);
    toast.success('OTP sent! (For MVP, enter any 6-digit code)');
  };

  const handleVerifyPhone = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    try {
      await verifyPhone(phone, otp);
      toast.success('Phone verified!');
      
      if (user?.role) {
        navigateToRole(user.role);
      } else {
        setStep('role');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (role) => {
    setLoading(true);
    try {
      await selectRole(role);
      toast.success(`Welcome as ${role}!`);
      navigateToRole(role);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Role selection failed');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    {
      id: 'ngo',
      title: 'NGO',
      description: 'Represent communities in need and receive food donations',
      icon: Building2,
      color: 'bg-primary',
    },
    {
      id: 'donor',
      title: 'Donor',
      description: 'Donate surplus food to help reduce waste and hunger',
      icon: Heart,
      color: 'bg-accent',
    },
    {
      id: 'volunteer',
      title: 'Volunteer',
      description: 'Help with last-mile delivery of food donations',
      icon: Truck,
      color: 'bg-success',
    },
  ];

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-bold text-primary">SmartPlate</h1>
            <p className="text-muted-foreground mt-2">Join the food rescue movement</p>
          </div>

          {/* Step: Login */}
          {step === 'login' && (
            <Card className="border-stone-200 shadow-card animate-fade-in" data-testid="login-card">
              <CardHeader className="text-center">
                <CardTitle className="font-heading text-xl">Welcome</CardTitle>
                <CardDescription>Sign in with Google to get started</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <div className="w-full flex justify-center" data-testid="google-login-container">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error('Google login failed')}
                    useOneTap
                    theme="outline"
                    size="large"
                    text="signin_with"
                    shape="pill"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center px-4">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step: Phone Verification */}
          {step === 'phone' && (
            <Card className="border-stone-200 shadow-card animate-fade-in" data-testid="phone-verification-card">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading text-xl">Phone Verification</CardTitle>
                </div>
                <CardDescription>Verify your phone number to continue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 bg-secondary rounded-lg text-sm">+91</span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="10-digit number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1"
                      data-testid="phone-input"
                    />
                  </div>
                </div>
                
                {!otpSent ? (
                  <Button 
                    className="w-full rounded-full" 
                    onClick={handleSendOtp}
                    data-testid="send-otp-btn"
                  >
                    Send OTP
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="otp">Enter OTP</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        data-testid="otp-input"
                      />
                      <p className="text-xs text-muted-foreground">
                        MVP Mode: Enter any 6-digit code
                      </p>
                    </div>
                    <Button 
                      className="w-full rounded-full" 
                      onClick={handleVerifyPhone}
                      disabled={loading}
                      data-testid="verify-otp-btn"
                    >
                      {loading ? 'Verifying...' : 'Verify & Continue'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step: Role Selection */}
          {step === 'role' && (
            <div className="space-y-4 animate-fade-in" data-testid="role-selection">
              <div className="text-center mb-6">
                <h2 className="font-heading text-xl font-semibold">Choose Your Role</h2>
                <p className="text-muted-foreground text-sm mt-1">Select how you want to contribute</p>
              </div>
              
              {roles.map((role, index) => (
                <Card 
                  key={role.id}
                  className={`border-stone-200 cursor-pointer card-hover stagger-${index + 1} animate-fade-in`}
                  onClick={() => !loading && handleSelectRole(role.id)}
                  data-testid={`role-${role.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${role.color} text-white`}>
                      <role.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{role.title}</h3>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Trust Badge */}
          <div className="flex items-center justify-center gap-2 mt-8 text-muted-foreground text-sm">
            <Shield className="h-4 w-4" />
            <span>Secure & Verified Platform</span>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};
