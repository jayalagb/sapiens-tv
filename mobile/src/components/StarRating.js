import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {colors} from '../theme';

export default function StarRating({rating = 0, size = 20, interactive = false, onRate}) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    let name;
    if (rating >= i) {
      name = 'star';
    } else if (rating >= i - 0.5) {
      name = 'star-half';
    } else {
      name = 'star-border';
    }

    const star = (
      <Icon key={i} name={name} size={size} color={colors.gold} />
    );

    if (interactive) {
      stars.push(
        <TouchableOpacity key={i} onPress={() => onRate && onRate(i)} activeOpacity={0.7}>
          {star}
        </TouchableOpacity>,
      );
    } else {
      stars.push(star);
    }
  }

  return <View style={styles.container}>{stars}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
