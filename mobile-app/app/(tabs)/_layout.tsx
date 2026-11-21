import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppTour from '@/components/AppTour';

function CustomTabIcon({ name, focused }: { name: any; focused: boolean }) {
  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons
        name={name}
        size={22}
        color={focused ? '#D4AF37' : '#78716C'}
        style={{
          opacity: focused ? 1 : 0.7,
        }}
      />
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
}

export default function TabLayout() {
  const [showTour, setShowTour] = React.useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem('hasSeenTour').then(val => {
      if (!val) setShowTour(true);
    });
  }, []);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#D4AF37',
          tabBarInactiveTintColor: '#78716C',
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: '#0A0000',
            borderTopColor: '#B8860B33',
            height: 70,
            paddingBottom: 22,
            borderTopWidth: 1,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 8.5,
            fontWeight: '900',
            letterSpacing: 0.2,
            marginTop: 2,
          }
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Vocal',
            tabBarIcon: ({ focused }) => <CustomTabIcon name="waveform" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Sargam',
            tabBarIcon: ({ focused }) => <CustomTabIcon name="music-note" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="riyaaz"
          options={{
            title: 'Riyaaz',
            tabBarIcon: ({ focused }) => <CustomTabIcon name="music-clef-treble" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="guru"
          options={{
            title: 'Guru',
            tabBarIcon: ({ focused }) => <CustomTabIcon name="account-tie-voice" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ focused }) => <CustomTabIcon name="history" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="recordings"
          options={{
            title: 'Vault',
            tabBarIcon: ({ focused }) => <CustomTabIcon name="folder-music" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="analyzer"
          options={{
            title: 'Analyze',
            tabBarIcon: ({ focused }) => <CustomTabIcon name="pulse" focused={focused} />,
          }}
        />
      </Tabs>
      {showTour && <AppTour onFinish={() => setShowTour(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    width: '100%',
  },
  activeIndicator: {
    position: 'absolute',
    top: -4,
    width: 20,
    height: 1.5,
    backgroundColor: '#D4AF37',
    borderRadius: 1,
  },
});
