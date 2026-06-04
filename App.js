import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider }      from './src/context/AppContext';
import { PurchaseProvider } from './src/context/PurchaseContext';
import HomeScreen           from './src/screens/HomeScreen';
import NavigatorScreen      from './src/screens/NavigatorScreen';
import OnboardingScreen     from './src/screens/OnboardingScreen';
import PaywallScreen        from './src/screens/PaywallScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('cnav_onboarded').then(v => {
      setInitialRoute(v ? 'Home' : 'Onboarding');
    });
  }, []);

  if (!initialRoute) return null;

  return (
    <PurchaseProvider>
      <AppProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Home"       component={HomeScreen} />
            <Stack.Screen name="Navigator"  component={NavigatorScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        {/* 페이월 모달: 어느 화면에서든 표시 가능 */}
        <PaywallScreen />
      </AppProvider>
    </PurchaseProvider>
  );
}
