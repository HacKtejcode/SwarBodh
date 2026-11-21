import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error checking auth token:', error);
      } finally {
        setIsReady(true);
      }
    }
    
    checkAuth();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A2235' }}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? "/(tabs)" : "/auth"} />;
}
