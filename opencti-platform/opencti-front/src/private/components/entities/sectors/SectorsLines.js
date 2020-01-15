import React, { Component } from 'react';
import * as PropTypes from 'prop-types';
import {
  compose,
  pipe,
  map,
  propOr,
  pathOr,
  sortBy,
  toLower,
  prop,
  filter,
  join,
  assoc,
} from 'ramda';
import { createPaginationContainer } from 'react-relay';
import graphql from 'babel-plugin-relay/macro';
import { withStyles } from '@material-ui/core';
import List from '@material-ui/core/List';
import { SectorLine, SectorLineDummy } from './SectorLine';
import inject18n from '../../../../components/i18n';

const styles = () => ({
  root: {
    margin: 0,
  },
});

class SectorsLinesComponent extends Component {
  render() {
    const { data, keyword, classes } = this.props;
    const sortByNameCaseInsensitive = sortBy(
      compose(
        toLower,
        prop('name'),
      ),
    );
    const filterSubsector = n => n.isSubsector === false;
    const filterByKeyword = n => keyword === ''
      || n.name.toLowerCase().indexOf(keyword.toLowerCase()) !== -1
      || n.description.toLowerCase().indexOf(keyword.toLowerCase()) !== -1
      || propOr('', 'subsectors_text', n)
        .toLowerCase()
        .indexOf(keyword.toLowerCase()) !== -1;
    const sectors = pipe(
      pathOr([], ['sectors', 'edges']),
      map(n => n.node),
      map(n => assoc(
        'subsectors_text',
        pipe(
          map(o => `${o.node.name} ${o.node.description}`),
          join(' | '),
        )(pathOr([], ['subsectors', 'edges'], n)),
        n,
      )),
      filter(filterSubsector),
      filter(filterByKeyword),
      sortByNameCaseInsensitive,
    )(data);
    return (
      <List
        component="nav"
        aria-labelledby="nested-list-subheader"
        className={classes.root}
      >
        {data
          ? map((sector) => {
            const subsectors = pipe(
              pathOr([], ['subsectors', 'edges']),
              map(n => n.node),
              filter(filterByKeyword),
              sortByNameCaseInsensitive,
            )(sector);
            return (
                <SectorLine
                  key={sector.id}
                  node={sector}
                  subsectors={subsectors}
                />
            );
          }, sectors)
          : Array.from(Array(20), (e, i) => <SectorLineDummy key={i} />)}
      </List>
    );
  }
}

SectorsLinesComponent.propTypes = {
  classes: PropTypes.object,
  keyword: PropTypes.string,
  data: PropTypes.object,
};

export const sectorsLinesQuery = graphql`
  query SectorsLinesPaginationQuery($count: Int!, $cursor: ID) {
    ...SectorsLines_data @arguments(count: $count, cursor: $cursor)
  }
`;

const SectorsLinesFragment = createPaginationContainer(
  SectorsLinesComponent,
  {
    data: graphql`
      fragment SectorsLines_data on Query
        @argumentDefinitions(
          count: { type: "Int", defaultValue: 25 }
          cursor: { type: "ID" }
        ) {
        sectors(first: $count, after: $cursor)
          @connection(key: "Pagination_sectors") {
          edges {
            node {
              id
              name
              description
              isSubsector
              subsectors {
                edges {
                  node {
                    id
                    name
                    description
                  }
                }
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
            globalCount
          }
        }
      }
    `,
  },
  {
    direction: 'forward',
    getConnectionFromProps(props) {
      return props.data && props.data.sectors;
    },
    getFragmentVariables(prevVars, totalCount) {
      return {
        ...prevVars,
        count: totalCount,
      };
    },
    getVariables(props, { count, cursor }) {
      return {
        count,
        cursor,
      };
    },
    query: sectorsLinesQuery,
  },
);

export default compose(
  inject18n,
  withStyles(styles),
)(SectorsLinesFragment);