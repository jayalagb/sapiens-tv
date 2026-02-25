import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import VideoCard from '../components/VideoCard';
import TagChip from '../components/TagChip';
import {getVideos, getTags, clearToken} from '../api';
import {colors, spacing, fontSize} from '../theme';

export default function HomeScreen({navigation, route}) {
  const [videos, setVideos] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef(null);

  const username = route.params?.username || '';
  const onLogout = route.params?.onLogout;

  const fetchVideos = useCallback(async (q = search, t = selectedTags) => {
    try {
      const data = await getVideos(q, t.map(tag => tag.name || tag));
      setVideos(data.videos || data);
    } catch (_) {}
  }, [search, selectedTags]);

  const fetchTags = useCallback(async () => {
    try {
      const data = await getTags();
      setTags(data.tags || data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    Promise.all([fetchVideos('', []), fetchTags()]).finally(() =>
      setLoading(false),
    );
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchVideos(search, selectedTags);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [search, selectedTags]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchVideos(search, selectedTags), fetchTags()]);
    setRefreshing(false);
  };

  const toggleTag = tag => {
    setSelectedTags(prev => {
      const exists = prev.find(t => (t.id || t) === (tag.id || tag));
      if (exists) return prev.filter(t => (t.id || t) !== (tag.id || tag));
      return [...prev, tag];
    });
  };

  const handleLogout = async () => {
    await clearToken();
    onLogout && onLogout();
  };

  const renderVideo = ({item, index}) => (
    <VideoCard
      video={item}
      onPress={() => navigation.navigate('Player', {uid: item.uid})}
    />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>SesamoTV</Text>
        <View style={styles.headerRight}>
          <Text style={styles.username}>{username}</Text>
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
            <Icon name="logout" size={24} color={colors.gray} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon
          name="search"
          size={20}
          color={colors.gray}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar videos..."
          placeholderTextColor={colors.gray}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close" size={20} color={colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsRow}
          contentContainerStyle={styles.tagsContent}>
          {tags.map(tag => (
            <TagChip
              key={tag.id}
              label={tag.name}
              selected={selectedTags.some(t => (t.id || t) === tag.id)}
              onPress={() => toggleTag(tag)}
            />
          ))}
        </ScrollView>
      )}

      {/* Video Grid */}
      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={item => item.uid}
        numColumns={2}
        contentContainerStyle={styles.grid}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="videocam-off" size={48} color={colors.grayLight} />
            <Text style={styles.emptyText}>No se encontraron videos</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.white},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  logo: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.accent,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  username: {
    fontSize: fontSize.md,
    color: colors.grayDark,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
  },
  searchIcon: {marginRight: spacing.sm},
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
    color: colors.black,
  },
  tagsRow: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  tagsContent: {
    paddingHorizontal: spacing.md,
  },
  grid: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.lg,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xl * 3,
  },
  emptyText: {
    color: colors.gray,
    fontSize: fontSize.lg,
    marginTop: spacing.md,
  },
});
