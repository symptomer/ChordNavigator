import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import HomeScreen from './src/screens/HomeScreen';
import NavigatorScreen from './src/screens/NavigatorScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home"      component={HomeScreen} />
          <Stack.Screen name="Navigator" component={NavigatorScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
