interface AgentMusicPreferences {
  musicType: string;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  lastUpdated: Date;
}

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  filePath: string;
}

interface MusicPlaylist {
  id: string;
  name: string;
  genre: string;
  tracks: MusicTrack[];
  coverUrl?: string;
}

class MusicControlService {
  private static agentPreferences = new Map<string, AgentMusicPreferences>();
  private static readonly MUSIC_BASE_PATH = './server/public/music';

  // Set agent music preferences
  static setAgentPreferences(
    agentEmail: string, 
    musicType: string, 
    volume: number, 
    shuffle: boolean = false, 
    repeat: boolean = false
  ): void {
    this.agentPreferences.set(agentEmail, {
      musicType,
      volume,
      shuffle,
      repeat,
      lastUpdated: new Date()
    });
    console.log(`🎵 Music preferences updated for ${agentEmail}: ${musicType} at ${volume}% (shuffle: ${shuffle}, repeat: ${repeat})`);
  }

  // Get agent music preferences
  static getAgentPreferences(agentEmail: string): AgentMusicPreferences | null {
    return this.agentPreferences.get(agentEmail) || null;
  }

  // Get available music playlists
  static getAvailablePlaylists(): MusicPlaylist[] {
    return [
      {
        id: 'lofi',
        name: 'Lo-Fi Beats',
        genre: 'Lo-Fi',
        tracks: [
          { id: 'lofi-1', title: 'Chill Vibes', artist: 'Lo-Fi Artist', duration: 180, url: '/music/lofi/chill-vibes.mp3', filePath: `${this.MUSIC_BASE_PATH}/lofi/chill-vibes.mp3` },
          { id: 'lofi-2', title: 'Study Session', artist: 'Lo-Fi Artist', duration: 240, url: '/music/lofi/study-session.mp3', filePath: `${this.MUSIC_BASE_PATH}/lofi/study-session.mp3` },
          { id: 'lofi-3', title: 'Night Drive', artist: 'Lo-Fi Artist', duration: 200, url: '/music/lofi/night-drive.mp3', filePath: `${this.MUSIC_BASE_PATH}/lofi/night-drive.mp3` },
          { id: 'lofi-4', title: 'Coffee Shop', artist: 'Lo-Fi Artist', duration: 195, url: '/music/lofi/coffee-shop.mp3', filePath: `${this.MUSIC_BASE_PATH}/lofi/coffee-shop.mp3` },
          { id: 'lofi-5', title: 'Rainy Day', artist: 'Lo-Fi Artist', duration: 220, url: '/music/lofi/rainy-day.mp3', filePath: `${this.MUSIC_BASE_PATH}/lofi/rainy-day.mp3` }
        ],
        coverUrl: '/music/covers/lofi-cover.jpg'
      },
      {
        id: 'edm',
        name: 'EDM Energy',
        genre: 'Electronic',
        tracks: [
          { id: 'edm-1', title: 'Pulse', artist: 'EDM Artist', duration: 180, url: '/music/edm/pulse.mp3', filePath: `${this.MUSIC_BASE_PATH}/edm/pulse.mp3` },
          { id: 'edm-2', title: 'Drop Zone', artist: 'EDM Artist', duration: 200, url: '/music/edm/drop-zone.mp3', filePath: `${this.MUSIC_BASE_PATH}/edm/drop-zone.mp3` },
          { id: 'edm-3', title: 'Neon Lights', artist: 'EDM Artist', duration: 195, url: '/music/edm/neon-lights.mp3', filePath: `${this.MUSIC_BASE_PATH}/edm/neon-lights.mp3` },
          { id: 'edm-4', title: 'Bass Boost', artist: 'EDM Artist', duration: 210, url: '/music/edm/bass-boost.mp3', filePath: `${this.MUSIC_BASE_PATH}/edm/bass-boost.mp3` },
          { id: 'edm-5', title: 'Synth Wave', artist: 'EDM Artist', duration: 185, url: '/music/edm/synth-wave.mp3', filePath: `${this.MUSIC_BASE_PATH}/edm/synth-wave.mp3` }
        ],
        coverUrl: '/music/covers/edm-cover.jpg'
      },
      {
        id: 'rock',
        name: 'Rock Classics',
        genre: 'Rock',
        tracks: [
          { id: 'rock-1', title: 'Guitar Solo', artist: 'Rock Artist', duration: 240, url: '/music/rock/guitar-solo.mp3', filePath: `${this.MUSIC_BASE_PATH}/rock/guitar-solo.mp3` },
          { id: 'rock-2', title: 'Power Chords', artist: 'Rock Artist', duration: 220, url: '/music/rock/power-chords.mp3', filePath: `${this.MUSIC_BASE_PATH}/rock/power-chords.mp3` },
          { id: 'rock-3', title: 'Drum Beat', artist: 'Rock Artist', duration: 200, url: '/music/rock/drum-beat.mp3', filePath: `${this.MUSIC_BASE_PATH}/rock/drum-beat.mp3` },
          { id: 'rock-4', title: 'Bass Line', artist: 'Rock Artist', duration: 235, url: '/music/rock/bass-line.mp3', filePath: `${this.MUSIC_BASE_PATH}/rock/bass-line.mp3` },
          { id: 'rock-5', title: 'Rock Anthem', artist: 'Rock Artist', duration: 280, url: '/music/rock/rock-anthem.mp3', filePath: `${this.MUSIC_BASE_PATH}/rock/rock-anthem.mp3` }
        ],
        coverUrl: '/music/covers/rock-cover.jpg'
      },
      {
        id: 'country',
        name: 'Country Roads',
        genre: 'Country',
        tracks: [
          { id: 'country-1', title: 'Acoustic Guitar', artist: 'Country Artist', duration: 195, url: '/music/country/acoustic-guitar.mp3', filePath: `${this.MUSIC_BASE_PATH}/country/acoustic-guitar.mp3` },
          { id: 'country-2', title: 'Steel Guitar', artist: 'Country Artist', duration: 210, url: '/music/country/steel-guitar.mp3', filePath: `${this.MUSIC_BASE_PATH}/country/steel-guitar.mp3` },
          { id: 'country-3', title: 'Fiddle Tune', artist: 'Country Artist', duration: 185, url: '/music/country/fiddle-tune.mp3', filePath: `${this.MUSIC_BASE_PATH}/country/fiddle-tune.mp3` },
          { id: 'country-4', title: 'Banjo Pickin', artist: 'Country Artist', duration: 200, url: '/music/country/banjo-pickin.mp3', filePath: `${this.MUSIC_BASE_PATH}/country/banjo-pickin.mp3` },
          { id: 'country-5', title: 'Harmonica Blues', artist: 'Country Artist', duration: 225, url: '/music/country/harmonica-blues.mp3', filePath: `${this.MUSIC_BASE_PATH}/country/harmonica-blues.mp3` }
        ],
        coverUrl: '/music/covers/country-cover.jpg'
      }
    ];
  }

  // Get playlist by ID
  static getPlaylistById(playlistId: string): MusicPlaylist | null {
    const playlists = this.getAvailablePlaylists();
    return playlists.find(p => p.id === playlistId) || null;
  }

  // Get track by ID
  static getTrackById(trackId: string): MusicTrack | null {
    const playlists = this.getAvailablePlaylists();
    for (const playlist of playlists) {
      const track = playlist.tracks.find(t => t.id === trackId);
      if (track) return track;
    }
    return null;
  }

  // Generate TwiML for hold music based on agent preferences
  static generateHoldMusicTwiML(agentEmail: string): string {
    const prefs = this.getAgentPreferences(agentEmail);
    
    // Default to lofi if no preferences set
    const musicType = prefs?.musicType || 'lofi';
    const volume = prefs?.volume || 25; // Reduced from 50% to 25% for less intrusive hold music
    
    // Get the first track from the selected playlist
    const playlist = this.getPlaylistById(musicType);
    const track = playlist?.tracks[0];
    
    if (!track) {
      // Fallback to external streaming if no local track found
      return this.generateFallbackTwiML(agentEmail, volume);
    }

    // Generate TwiML with local music file
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play loop="0" volume="${volume}">${track.url}</Play>
</Response>`;

    console.log(`🎵 Generated hold music TwiML for ${agentEmail}: ${musicType} track "${track.title}" at ${volume}%`);
    return twiml;
  }

  // Generate fallback TwiML using external streaming
  private static generateFallbackTwiML(agentEmail: string, volume: number): string {
    const prefs = this.getAgentPreferences(agentEmail);
    const musicType = prefs?.musicType || 'lofi';
    
    // External music URLs based on type
    const musicUrls = {
      lofi: 'https://ok-fine-give-mmandella.replit.app/stream/lofi',
      edm: 'https://ok-fine-give-mmandella.replit.app/stream/electronic',
      rock: 'https://ok-fine-give-mmandella.replit.app/stream/rock',
      country: 'https://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.wav',
      classical: 'https://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.wav',
      ambient: 'https://com.twilio.music.ambient.s3.amazonaws.com/Just_Nap_Time.wav',
      jazz: 'https://com.twilio.music.jazz.s3.amazonaws.com/JazzMafia_Tahoe_Rim_2-007.wav',
      pop: 'https://ok-fine-give-mmandella.replit.app/stream/pop'
    };

    const musicUrl = musicUrls[musicType as keyof typeof musicUrls] || musicUrls.lofi;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play loop="0" volume="${volume}">${musicUrl}</Play>
</Response>`;

    console.log(`🎵 Using fallback streaming music for ${agentEmail}: ${musicType} at ${volume}%`);
    return twiml;
  }

  // Get available music types (for backward compatibility)
  static getAvailableMusicTypes(): Array<{value: string, label: string, url: string}> {
    const playlists = this.getAvailablePlaylists();
    return playlists.map(playlist => ({
      value: playlist.id,
      label: playlist.name,
      url: playlist.tracks[0]?.url || ''
    }));
  }

  // Check if music files exist
  static async validateMusicFiles(): Promise<{valid: boolean, missing: string[]}> {
    const fs = require('fs').promises;
    
    const missing: string[] = [];
    const playlists = this.getAvailablePlaylists();
    
    for (const playlist of playlists) {
      for (const track of playlist.tracks) {
        try {
          await fs.access(track.filePath);
        } catch {
          missing.push(track.filePath);
        }
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  // Get music statistics
  static getMusicStats(): {totalPlaylists: number, totalTracks: number, totalDuration: number} {
    const playlists = this.getAvailablePlaylists();
    const totalTracks = playlists.reduce((sum, playlist) => sum + playlist.tracks.length, 0);
    const totalDuration = playlists.reduce((sum, playlist) => 
      sum + playlist.tracks.reduce((trackSum, track) => trackSum + track.duration, 0), 0
    );
    
    return {
      totalPlaylists: playlists.length,
      totalTracks,
      totalDuration
    };
  }
}

export { MusicControlService, type AgentMusicPreferences, type MusicTrack, type MusicPlaylist };