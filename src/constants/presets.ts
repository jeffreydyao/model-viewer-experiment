import type { LightingId, SceneId } from '../types/library';

export const scenePresets: Record<
  SceneId,
  {
    label: string;
    background: string;
    groundColor: string;
    accentColor: string;
  }
> = {
  white: {
    label: 'White Studio',
    background: '#F9FBFF',
    groundColor: '#E6EEF7',
    accentColor: '#A7B5C7',
  },
  black: {
    label: 'Black Stage',
    background: '#040507',
    groundColor: '#11151E',
    accentColor: '#444B5D',
  },
  garden: {
    label: 'Garden',
    background: '#B8E7FF',
    groundColor: '#6CBF75',
    accentColor: '#4D9D56',
  },
  gray: {
    label: 'Neutral Gray',
    background: '#BFC4CC',
    groundColor: '#969EA8',
    accentColor: '#7B8591',
  },
};

export const lightingPresets: Record<
  LightingId,
  {
    label: string;
    ambient: number;
    key: number;
    fill: number;
    rim: number;
    keyColor: string;
    fillColor: string;
    rimColor: string;
  }
> = {
  balanced: {
    label: 'Balanced',
    ambient: 0.6,
    key: 1,
    fill: 0.45,
    rim: 0.35,
    keyColor: '#FFFFFF',
    fillColor: '#A7CAFF',
    rimColor: '#FFF4D2',
  },
  dramatic: {
    label: 'Dramatic',
    ambient: 0.2,
    key: 1.3,
    fill: 0.15,
    rim: 0.85,
    keyColor: '#FFF0D6',
    fillColor: '#8CA9D9',
    rimColor: '#FFFFFF',
  },
  flat: {
    label: 'Flat',
    ambient: 1.1,
    key: 0,
    fill: 0,
    rim: 0,
    keyColor: '#FFFFFF',
    fillColor: '#FFFFFF',
    rimColor: '#FFFFFF',
  },
  night: {
    label: 'Night',
    ambient: 0.15,
    key: 0.75,
    fill: 0.25,
    rim: 0.45,
    keyColor: '#8AC2FF',
    fillColor: '#476CA5',
    rimColor: '#D4E5FF',
  },
};
