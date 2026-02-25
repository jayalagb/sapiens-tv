import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StarRating from '../components/StarRating';
import TagChip from '../components/TagChip';
import VideoCard from '../components/VideoCard';
import {getVideo, getStreamUrl, trackView, rateVideo, getVideos} from '../api';
import {colors, spacing, fontSize} from '../theme';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export default function PlayerScreen({navigation, route}) {
  const {uid} = route.params;
  const [video, setVideo] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);

  const loadVideo = useCallback(async () => {
    setLoading(true);
    try {
      const [videoData, url] = await Promise.all([
        getVideo(uid),
        getStreamUrl(uid),
      ]);
      const v = videoData.video || videoData;
      setVideo(v);
      setStreamUrl(url);
      setAvgRating(parseFloat(v.average_rating) || 0);
      setUserRating(v.user_rating || 0);

      // Track view
      trackView(uid);

      // Load related videos
      try {
        const allData = await getVideos();
        const all = allData.videos || allData;
        setRelated(all.filter(x => x.uid !== uid).slice(0, 6));
      } catch (_) {}
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el video');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const handleRate = async rating => {
    try {
      const result = await rateVideo(uid, rating);
      setUserRating(rating);
      setAvgRating(parseFloat(result.average_rating) || rating);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const formatDate = dateStr => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!video) return null;

  const videoTags = video.tags || [];

  return (
    <ScrollView style={styles.container}>
      {/* Video Player */}
      {streamUrl && (
        <Video
          source={{uri: streamUrl}}
          style={styles.player}
          controls
          resizeMode="contain"
          paused={false}
        />
      )}

      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{video.title}</Text>

        {/* Meta */}
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Icon name="visibility" size={16} color={colors.gray} />
            <Text style={styles.metaText}>
              {video.view_count || 0} vista{(video.view_count || 0) !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.metaText}>{formatDate(video.created_at)}</Text>
        </View>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Promedio:</Text>
            <StarRating rating={avgRating} size={22} />
            <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
          </View>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Tu rating:</Text>
            <StarRating
              rating={userRating}
              size={28}
              interactive
              onRate={handleRate}
            />
          </View>
        </View>

        {/* Description */}
        {video.description ? (
          <Text style={styles.description}>{video.description}</Text>
        ) : null}

        {/* Tags */}
        {videoTags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.sectionTitle}>Etiquetas</Text>
            <View style={styles.tagsRow}>
              {videoTags.map(tag => (
                <TagChip
                  key={tag.id || tag}
                  label={tag.name || tag}
                  onPress={() => {
                    navigation.navigate('Home', {filterTag: tag});
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Related Videos */}
        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.sectionTitle}>Más Videos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {related.map(v => (
                <View key={v.uid} style={styles.relatedCard}>
                  <VideoCard
                    video={v}
                    onPress={() =>
                      navigation.push('Player', {uid: v.uid})
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.black},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.black,
  },
  player: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
    backgroundColor: colors.black,
  },
  content: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -12,
    padding: spacing.md,
    minHeight: 400,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.black,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.gray,
  },
  ratingSection: {
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  ratingLabel: {
    fontSize: fontSize.md,
    color: colors.grayDark,
    width: 80,
  },
  ratingValue: {
    fontSize: fontSize.md,
    color: colors.grayDark,
    fontWeight: '600',
  },
  description: {
    fontSize: fontSize.md,
    color: colors.grayDark,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  tagsSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.black,
    marginBottom: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  relatedSection: {
    marginBottom: spacing.xl,
  },
  relatedCard: {
    width: 180,
    marginRight: spacing.sm,
  },
});
