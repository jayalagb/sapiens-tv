import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import StarRating from './StarRating';
import {getThumbnailUrl} from '../api';
import {colors, spacing, fontSize} from '../theme';

export default function VideoCard({video, onPress}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{uri: getThumbnailUrl(video.uid)}}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <View style={styles.meta}>
          <StarRating rating={parseFloat(video.average_rating) || 0} size={14} />
          <Text style={styles.views}>
            {video.view_count || 0} vista{(video.view_count || 0) !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.grayLight,
  },
  info: {
    padding: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.black,
    marginBottom: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  views: {
    fontSize: fontSize.sm,
    color: colors.gray,
  },
});
