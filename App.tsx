import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme as NavigationDarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { HelpScreen } from './src/screens/HelpScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ServerScreen } from './src/screens/ServerScreen';
import { ViewerScreen } from './src/screens/ViewerScreen';
import { useAppStore } from './src/store/useAppStore';

const Tab = createBottomTabNavigator();

export default function App() {
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const theme = useMemo(() => {
    const base = MD3DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: '#8CD37D',
        secondary: '#7AC9D9',
        tertiary: '#F0B46A',
        surface: '#121724',
        background: '#0A0F1A',
      },
      fonts: DefaultTheme.fonts,
    };
  }, []);

  const navTheme = useMemo(
    () => ({
      ...NavigationDarkTheme,
      colors: {
        ...NavigationDarkTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.outline,
      },
    }),
    [theme],
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: { backgroundColor: '#0E1626' },
              tabBarActiveTintColor: '#8CD37D',
              tabBarInactiveTintColor: '#93A1B8',
            }}
          >
            <Tab.Screen
              name="Viewer"
              component={ViewerScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="cube-scan" color={color} size={size} />
                ),
              }}
            />
            <Tab.Screen
              name="Library"
              component={LibraryScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="folder-multiple-outline" color={color} size={size} />
                ),
              }}
            />
            <Tab.Screen
              name="Server"
              component={ServerScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="server-network-outline" color={color} size={size} />
                ),
              }}
            />
            <Tab.Screen
              name="Help"
              component={HelpScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="help-circle-outline" color={color} size={size} />
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
